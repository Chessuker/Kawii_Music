import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users, tracks, histories, artists, genres, trackArtists, trackGenres, playlists, playlistTracks, albums, trackAlbums, likeSongs } from './schema';
import { eq, or, and, ilike, inArray, sql as drizzleSql, desc, asc } from 'drizzle-orm';

export type Env = {
  DATABASE_URL: string;
  BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// --- 1. API ดึงข้อมูล User ---
app.get('/api/users', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const allUsers = await db.select().from(users);
    return c.json({ success: true, data: allUsers });
  } catch (error) {
    console.error("🔥 Users Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 2. API ดึงข้อมูลเพลง (พร้อมระบบ Smart Query Parser และ Datalist Search) ---
app.get('/api/tracks', async (c) => {
  try {
    const url = new URL(c.req.url);
    let searchTitle = url.searchParams.get('search') || '';
    let queryArtist = url.searchParams.get('artist') || ''; 
    let queryGenre = url.searchParams.get('genre') || ''; 
    let queryAlbum = url.searchParams.get('album') || ''; 
    
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 🚀 Smart Query Parser: ดึงคำสั่งประเภท artist:"xxx", album:xxx ออกจากช่อง Search หลัก
    const extractTag = (tag: string, currentVal: string) => {
        const regex = new RegExp(`${tag}:"([^"]+)"|${tag}:([^\\s]+)`, 'i');
        const match = searchTitle.match(regex);
        if (match) {
            searchTitle = searchTitle.replace(match[0], '').trim(); // ลบคำสั่งออกจาก Title
            return match[1] || match[2]; // match[1] สำหรับแบบมี "", match[2] แบบไม่มี ""
        }
        return currentVal;
    };

    queryArtist = extractTag('artist', queryArtist);
    queryAlbum = extractTag('album', queryAlbum);
    queryGenre = extractTag('genre', queryGenre);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // 1. สร้างเงื่อนไขการค้นหา (Conditions)
    let conditions = [];
    
    // ค้นหาจากชื่อเพลง (ส่วนที่เหลือจากการสกัด Tag ออกไปแล้ว)
    if (searchTitle) conditions.push(ilike(tracks.title, `%${searchTitle}%`));
    
    // กรองศิลปิน (รองรับทั้ง ID และ ชื่อบางส่วน)
    if (queryArtist) {
      const artistCond = isUUID(queryArtist)
          ? or(eq(artists.id, queryArtist), ilike(artists.name, `%${queryArtist}%`))
          : ilike(artists.name, `%${queryArtist}%`); // ถ้าเป็นแค่ชื่อ ให้หาจาก name อย่างเดียว

      const artistSubq = db.select({ trackId: (trackArtists as any).trackId || (trackArtists as any).track_id })
                           .from(trackArtists)
                           .innerJoin(artists, eq((trackArtists as any).artistId || (trackArtists as any).artist_id, artists.id))
                           .where(artistCond);
      conditions.push(inArray(tracks.id, artistSubq));
    }
    
    // กรองแนวเพลง
    if (queryGenre) {
      const genreCond = isUUID(queryGenre)
          ? or(eq(genres.id, queryGenre), ilike(genres.name, `%${queryGenre}%`))
          : ilike(genres.name, `%${queryGenre}%`);

      const genreSubq = db.select({ trackId: (trackGenres as any).trackId || (trackGenres as any).track_id })
                          .from(trackGenres)
                          .innerJoin(genres, eq((trackGenres as any).genreId || (trackGenres as any).genre_id, genres.id))
                          .where(genreCond);
      conditions.push(inArray(tracks.id, genreSubq));
    }

    // กรองอัลบั้ม
    if (queryAlbum) {
      const albumCond = isUUID(queryAlbum)
          ? or(eq(albums.id, queryAlbum), ilike(albums.title, `%${queryAlbum}%`))
          : ilike(albums.title, `%${queryAlbum}%`);

      const albumSubq = db.select({ trackId: (trackAlbums as any).trackId || (trackAlbums as any).track_id })
                          .from(trackAlbums)
                          .innerJoin(albums, eq((trackAlbums as any).albumId || (trackAlbums as any).album_id, albums.id))
                          .where(albumCond);
      conditions.push(inArray(tracks.id, albumSubq));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ... (ส่วนที่เหลือของ API นี้ปล่อยไว้เหมือนเดิมครับ: การนับจำนวน, ดึงข้อมูล, ประกอบร่างข้อมูล) ...
    const countResult = await db.select({ count: drizzleSql`count(*)` }).from(tracks).where(whereClause);
    const totalTracks = Number(countResult[0].count);
    const totalPages = Math.ceil(totalTracks / limit);

    const paginatedTracks = await db.select().from(tracks)
      .where(whereClause)
      .limit(limit).offset(offset)
      .orderBy(desc(tracks.id));

    if (paginatedTracks.length === 0) {
      return c.json({ success: true, data: [], pagination: { page, limit, totalTracks, totalPages } });
    }

    const trackIds = paginatedTracks.map(t => t.id);
    const [tArtists, tGenres, tAlbums, allArtists, allGenres, allAlbums] = await Promise.all([
      db.select().from(trackArtists).where(inArray((trackArtists as any).trackId || (trackArtists as any).track_id, trackIds)),
      db.select().from(trackGenres).where(inArray((trackGenres as any).trackId || (trackGenres as any).track_id, trackIds)),
      db.select().from(trackAlbums).where(inArray((trackAlbums as any).trackId || (trackAlbums as any).track_id, trackIds)),
      db.select().from(artists),
      db.select().from(genres),
      db.select().from(albums)
    ]);

    const enrichedTracks = paginatedTracks.map(track => {
      const tId = track.id;
      const tArtistIds = tArtists.filter(ta => (ta as any).trackId === tId || (ta as any).track_id === tId).map(ta => (ta as any).artistId || (ta as any).artist_id);
      const tGenreIds = tGenres.filter(tg => (tg as any).trackId === tId || (tg as any).track_id === tId).map(tg => (tg as any).genreId || (tg as any).genre_id);
      const trackAlbumRel = tAlbums.find(ta => (ta as any).trackId === tId || (ta as any).track_id === tId);

      return {
        ...track,
        artists: allArtists.filter(a => tArtistIds.includes(a.id)),
        genres: allGenres.filter(g => tGenreIds.includes(g.id)),
        album: trackAlbumRel ? allAlbums.find(a => a.id === ((trackAlbumRel as any).albumId || (trackAlbumRel as any).album_id)) : null
      };
    });

    return c.json({ success: true, data: enrichedTracks, pagination: { page, limit, totalTracks, totalPages } });
  } catch (error) {
    console.error("🔥 Search/Filter Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 3. API สำหรับอัปโหลดเพลง ---
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File;
    const title = body['title'] as string;
    const duration = body['duration'] as string || '00:00:00';
    const albumId = body['albumId'] as string;

    if (!file || !title) {
      return c.json({ error: 'กรุณาใส่ชื่อเพลงและไฟล์เสียง' }, 400);
    }

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const arrayBuffer = await file.arrayBuffer();

    // 1. อัปโหลดลง R2
    await c.env.BUCKET.put(fileName, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });

    const generatedAudioUrl = `http://127.0.0.1:8787/assets/${fileName}`;

    // 2. บันทึกลง Database
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    
    const artistIds: string[] = JSON.parse(body['artistIds'] as string || '[]');
    const genreIds: string[] = JSON.parse(body['genreIds'] as string || '[]');

    const newTrack = await db.insert(tracks).values({
      title: title,
      duration: duration,
      isFree: true,         
      audioUrl: generatedAudioUrl, 
    }).returning({ id: tracks.id });

    const trackId = newTrack[0].id;

    // --- ส่วน M:N (เพิ่ม trackAlbums เข้าไป) ---
    if (artistIds.length > 0) {
      await db.insert(trackArtists).values(artistIds.map(id => ({ trackId, artistId: id })));
    }
    if (genreIds.length > 0) {
      await db.insert(trackGenres).values(genreIds.map(id => ({ trackId, genreId: id })));
    }
    // 👇 ผูกอัลบั้ม (ถ้ามีการเลือกอัลบั้มมาด้วย) 👇
    if (albumId) {
      await db.insert(trackAlbums).values({ trackId, albumId }); //[cite: 1]
    }

    return c.json({ success: true, message: 'อัปโหลดสำเร็จ!', trackId });
  } catch (error) {
    console.error("🔥 Upload Error:", error);
    // ส่ง Error กลับไปให้ Frontend เห็นด้วย
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 4. API สำหรับเสิร์ฟไฟล์เพลงจาก R2 ---
app.get('/assets/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.notFound();
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  
  return new Response(object.body, { headers });
});

// --- 5. API อัปเดตยอดวิวและเก็บประวัติการฟัง (อิงตาม streaming_postgres_v2.sql) ---
app.post('/api/tracks/:id/play', async (c) => {
  const trackId = c.req.param('id');
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId; 

    const dbClient = neon(c.env.DATABASE_URL);
    const db = drizzle(dbClient);

    // แก้ชื่อคอลัมน์ให้ตรงกับที่ Drizzle pull มา (viewCount)
    await db.update(tracks)
      .set({ viewCount: drizzleSql`${tracks.viewCount} + 1` }) 
      .where(eq(tracks.id, trackId));

    if (userId) {
      await db.insert(histories).values({
        // ถ้า schema คุณเป็น userId และ trackId ให้แก้เป็นแบบนี้ครับ:
        userId: userId,    
        trackId: trackId,  
      });
    }

    return c.json({ success: true, message: 'บันทึกประวัติการฟังสำเร็จ' });
  } catch (error) {
    console.error("🔥 Update History Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 6. API ดึงข้อมูลศิลปินและแนวเพลงสำหรับฟอร์มอัปโหลด ---
app.get('/api/metadata', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // ดึงข้อมูลทั้งสองตารางพร้อมกันเพื่อความเร็ว
    const [allArtists, allGenres] = await Promise.all([
      db.select().from(artists),
      db.select().from(genres)
    ]);
    
    return c.json({ success: true, artists: allArtists, genres: allGenres });
  } catch (error) {
    console.error("🔥 Metadata Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 7. API แก้ไขข้อมูลเพลง (Metadata) ---
app.put('/api/tracks/:id', async (c) => {
  const trackId = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const { title, artistIds, genreIds } = body;

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. อัปเดตชื่อเพลง (ส่วน updated_at ตัว Database มี Trigger คอยอัปเดตให้อัตโนมัติอยู่แล้ว!)
    await db.update(tracks)
      .set({ title: title })
      .where(eq(tracks.id, trackId));

    // 2. อัปเดตศิลปิน (ลบของเก่าออกให้หมดก่อน แล้ว Insert ใหม่)
    await db.delete(trackArtists).where(eq(trackArtists.trackId, trackId));
    if (artistIds && artistIds.length > 0) {
      await db.insert(trackArtists).values(
        artistIds.map((id: string) => ({ trackId: trackId, artistId: id }))
      );
    }

    // 3. อัปเดตแนวเพลง (ทำเหมือนศิลปิน)
    await db.delete(trackGenres).where(eq(trackGenres.trackId, trackId));
    if (genreIds && genreIds.length > 0) {
      await db.insert(trackGenres).values(
        genreIds.map((id: string) => ({ trackId: trackId, genreId: id }))
      );
    }

    // 4. อัปเดตอัลบั้ม
    const { albumId } = body;
    // ลบการผูกอัลบั้มเดิมทิ้งก่อน
    await db.delete(trackAlbums).where(eq((trackAlbums as any).trackId || (trackAlbums as any).track_id, trackId));
    if (albumId) {
      await db.insert(trackAlbums).values({ trackId: trackId, albumId: albumId } as any);
    }

    return c.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (error) {
    console.error("🔥 Edit Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 8. API ลบเพลง (ลบทั้งใน DB และไฟล์ใน R2) ---
app.delete('/api/tracks/:id', async (c) => {
  const trackId = c.req.param('id');

  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ค้นหาเพลงก่อนเพื่อเอา URL ไปลบไฟล์ใน R2
    const targetTracks = await db.select().from(tracks).where(eq(tracks.id, trackId));
    if (targetTracks.length === 0) {
      return c.json({ error: 'ไม่พบเพลงนี้ในระบบ' }, 404);
    }
    
    const track = targetTracks[0];

    // 2. ดึงชื่อไฟล์ (Key) ออกจาก audioUrl เพื่อไปลบใน R2
    // หน้าตา URL เราคือ http://127.0.0.1:8787/assets/ชื่อไฟล์.mp3
    const urlParts = track.audioUrl.split('/assets/');
    if (urlParts.length > 1) {
      const fileKey = urlParts[1];
      await c.env.BUCKET.delete(fileKey); // ลบไฟล์ออกจาก Cloudflare R2
    }

    // 3. ลบข้อมูลจาก Database (ON DELETE CASCADE จะจัดการตารางอื่นให้เอง)
    await db.delete(tracks).where(eq(tracks.id, trackId));

    return c.json({ success: true, message: 'ลบเพลงและไฟล์เสียงเรียบร้อย' });
  } catch (error) {
    console.error("🔥 Delete Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- ฟังก์ชันช่วยเหลือสำหรับเข้ารหัสผ่าน (ใช้ WebCrypto API ของ Cloudflare) ---
async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- 9. API สมัครสมาชิก (Register) ---
app.post('/api/auth/register', async (c) => {
  try {
    const { email, username, password, displayName } = await c.req.json();
    if (!email || !username || !password) return c.json({ error: 'กรอกข้อมูลไม่ครบ' }, 400);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // เช็กว่ามี email หรือ username นี้ในระบบหรือยัง
    const existingUser = await db.select().from(users).where(
      or(eq(users.email, email), eq(users.username, username))
    );
    if (existingUser.length > 0) return c.json({ error: 'Email หรือ Username นี้ถูกใช้ไปแล้ว' }, 400);

    const hashedPassword = await hashPassword(password);

    // บันทึกลง Database
    const newUser = await db.insert(users).values({
      email,
      username,
      passwordHash: hashedPassword, // อิงตาม schema (passwordHash หรือ password_hash)
      displayName: displayName || username
    }).returning({ id: users.id, username: users.username, displayName: users.displayName });

    return c.json({ success: true, user: newUser[0] });
  } catch (error) {
    console.error("🔥 Register Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 10. API เข้าสู่ระบบ (Login) ---
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const targetUsers = await db.select().from(users).where(eq(users.username, username));
    if (targetUsers.length === 0) return c.json({ error: 'ไม่พบผู้ใช้งานนี้' }, 401);

    const user = targetUsers[0];
    const hashedPassword = await hashPassword(password);

    if (user.passwordHash !== hashedPassword) {
      return c.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    }

    // ส่งข้อมูลผู้ใช้กลับไป (ไม่ส่งรหัสผ่านกลับไปเด็ดขาด)
    return c.json({ 
      success: true, 
      user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName } 
    });
  } catch (error) {
    console.error("🔥 Login Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 11. API ดึงเพลย์ลิสต์ของผู้ใช้งาน ---
app.get('/api/users/:id/playlists', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const userPlaylists = await db.select().from(playlists).where(eq(playlists.userId, userId));
    return c.json({ success: true, data: userPlaylists });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 12. API สร้างเพลย์ลิสต์ใหม่ ---
app.post('/api/playlists', async (c) => {
  try {
    const { name, userId } = await c.req.json();
    if (!name || !userId) return c.json({ error: 'ข้อมูลไม่ครบ' }, 400);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const newPlaylist = await db.insert(playlists).values({
      name,
      userId
    }).returning();

    return c.json({ success: true, data: newPlaylist[0] });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 13. API เพิ่มเพลงเข้าเพลย์ลิสต์ ---
app.post('/api/playlists/:id/tracks', async (c) => {
  try {
    const playlistId = c.req.param('id');
    const { trackId } = await c.req.json();

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // หา position ล่าสุด (อิงตาม schema ที่บังคับว่า position ห้ามว่าง)
    const countResult = await db.select({ count: drizzleSql`count(*)` }).from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
    const nextPosition = Number(countResult[0].count);

    await db.insert(playlistTracks).values({
      playlistId,
      trackId,
      position: nextPosition
    });

    return c.json({ success: true, message: 'เพิ่มเพลงเข้าเพลย์ลิสต์แล้ว' });
  } catch (error) {
    console.error("🔥 Add Track to Playlist Error:", error);
    return c.json({ success: false, error: 'อาจมีเพลงนี้ในเพลย์ลิสต์แล้ว หรือเซิร์ฟเวอร์ขัดข้อง' }, 500);
  }
});

// --- 14. API ดึงรายละเอียดเพลย์ลิสต์และรายการเพลงข้างใน ---
app.get('/api/playlists/:id', async (c) => {
  try {
    const playlistId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ดึงชื่อและข้อมูลเพลย์ลิสต์
    const targetPlaylists = await db.select().from(playlists).where(eq(playlists.id, playlistId));
    if (targetPlaylists.length === 0) return c.json({ error: 'ไม่พบเพลย์ลิสต์นี้' }, 404);

    // 2. ดึงเพลงที่อยู่ในเพลย์ลิสต์นี้ พร้อม JOIN กับตาราง tracks และเรียงลำดับตาม position
    const tracksInPlaylist = await db.select({
      track: tracks,
      position: playlistTracks.position
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position)); // เรียงตามคิวที่แอดเข้ามา

    // 3. จัดรูปแบบให้ Frontend ใช้ง่ายๆ (เอาแค่ก้อน track)
    const formattedTracks = tracksInPlaylist.map(t => t.track);

    return c.json({ 
      success: true, 
      playlist: targetPlaylists[0], 
      tracks: formattedTracks 
    });
  } catch (error) {
    console.error("🔥 Get Playlist Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 15. API ดึงรายการอัลบั้ม ---
app.get('/api/albums', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const allAlbums = await db.select().from(albums);
    return c.json({ success: true, data: allAlbums });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 16. API สร้างอัลบั้มใหม่ ---
app.post('/api/albums', async (c) => {
  try {
    const { title, imgUrl, releaseDate } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const newAlbum = await db.insert(albums).values({
      title,
      imgUrl: imgUrl || null,
      releaseDate: releaseDate ? new Date(releaseDate) : new Date()
    }).returning();

    return c.json({ success: true, data: newAlbum[0] });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 17. API สร้างศิลปิน และ แนวเพลง (Quick Add) ---
app.post('/api/artists', async (c) => {
  const { name } = await c.req.json();
  const db = drizzle(neon(c.env.DATABASE_URL));
  const newArtist = await db.insert(artists).values({ name }).returning();
  return c.json({ success: true, data: newArtist[0] });
});

app.post('/api/genres', async (c) => {
  const { name } = await c.req.json();
  const db = drizzle(neon(c.env.DATABASE_URL));
  const newGenre = await db.insert(genres).values({ name }).returning();
  return c.json({ success: true, data: newGenre[0] });
});

// --- 18. API ดึงเพลงจาก Internet Archive อัตโนมัติ (V3 - Auto Extract Metadata) ---
app.post('/api/sync-ia', async (c) => {
  try {
    const { identifier } = await c.req.json();
    if (!identifier) return c.json({ error: 'กรุณาระบุ Identifier' }, 400);

    console.log(`⏳ เริ่มดึงข้อมูลจาก IA: ${identifier}...`); 
    const iaRes = await fetch(`https://archive.org/metadata/${identifier}`);
    const iaData = await iaRes.json();

    if (!iaData.files || iaData.files.length === 0) {
      return c.json({ error: 'ไม่พบไฟล์ใน Identifier นี้' }, 404);
    }

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // เอาเฉพาะ FLAC หรือ MP3
    const audioFiles = iaData.files.filter((f: any) => 
      f.name.toLowerCase().endsWith('.flac') || f.name.toLowerCase().endsWith('.mp3')
    );

    const imageFiles = iaData.files.filter((f: any) => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.png'));
    const defaultAlbumCover = imageFiles.length > 0 ? `https://archive.org/download/${identifier}/${imageFiles[0].name}` : null;

    console.log(`🎵 พบไฟล์เสียง ${audioFiles.length} ไฟล์ กำลังวิเคราะห์ Metadata...`);

    // --- 🚀 1. โหลดข้อมูล Artist/Album/Genre ที่มีอยู่เข้า Memory ---
    // (แยก Track ออกมา เพื่อไม่ให้ติด Limit 64MB ของ Neon)
    const [existingArtists, existingAlbums, existingGenres] = await Promise.all([
        db.select().from(artists),
        db.select().from(albums),
        db.select().from(genres)
    ]);

    const artistMap = new Map(existingArtists.map(a => [a.name.toLowerCase(), a.id]));
    const albumMap = new Map(existingAlbums.map(a => [a.title.toLowerCase(), a.id]));
    const genreMap = new Map(existingGenres.map(g => [g.name.toLowerCase(), g.id]));

    // 👇 แก้ปัญหา Neon 64MB Limit ด้วยการโหลด URL แบบแบ่งหน้า (Chunking) 👇
    const existingUrlSet = new Set<string>();
    let urlOffset = 0;
    const urlLimit = 20000; // โหลดทีละ 20,000 แถว
    
    console.log("⏳ กำลังโหลดรายการ URL ที่มีอยู่เพื่อเช็กไฟล์ซ้ำ (Bypass 64MB Limit)...");
    while (true) {
        const chunk = await db.select({ audioUrl: tracks.audioUrl })
                              .from(tracks)
                              .limit(urlLimit)
                              .offset(urlOffset);
        
        if (chunk.length === 0) break; // โหลดจนหมดแล้วให้หยุด
        
        chunk.forEach(t => existingUrlSet.add(t.audioUrl));
        urlOffset += urlLimit;
    }
    console.log(`✅ โหลด URL สำเร็จทั้งหมด ${existingUrlSet.size} รายการ`);

    const newArtists = new Set<string>();
    const newAlbums = new Set<string>();
    const newGenres = new Set<string>();

    const parsedTracks = [];

    // --- 🚀 2. วนลูปอ่านข้อมูลและแยก Metadata ออกจาก Internet Archive ---
    for (const file of audioFiles) {
      const encodedPath = file.name.split('/').map(encodeURIComponent).join('/');
      const audioUrl = `https://archive.org/download/${identifier}/${encodedPath}`;

      if (existingUrlSet.has(audioUrl)) continue;

      const fileNameParts = file.name.split('/');
      const rawName = fileNameParts[fileNameParts.length - 1];
      
      // 1. หา Title (ถ้าไม่มีใน Tag ให้ลบนามสกุลและตัวเลขข้างหน้าออกจากชื่อไฟล์)
      let cleanTitle = file.title || rawName.replace(/\.[^/.]+$/, "").replace(/^\d+[\s-._]*/, "");

      // 2. หา Artist (เรียงความสำคัญ: File Tag -> Item Tag -> Unknown)
      let artistName = file.creator ? String(file.creator).trim() : null;
      if (!artistName && iaData.metadata?.creator) {
          artistName = Array.isArray(iaData.metadata.creator) 
              ? String(iaData.metadata.creator[0]).trim() 
              : String(iaData.metadata.creator).trim();
      }
      if (!artistName) artistName = 'Unknown Artist';

      // 3. หา Album (เรียงความสำคัญ: File Tag -> 📁 ชื่อโฟลเดอร์ชั้นที่ 2 -> Item Title -> Unknown)
      let albumName = file.album ? String(file.album).trim() : null;
      
      // 👇 ไม้ตาย: ดึงจากชื่อโฟลเดอร์ (เช่น Redtopia FLAC 05 / 2006 - The Two Towers / ...)
      if (!albumName && fileNameParts.length >= 3) {
          albumName = fileNameParts[1].trim(); 
      }
      
      if (!albumName && iaData.metadata?.title) {
          albumName = String(iaData.metadata.title).trim();
      }
      if (!albumName) albumName = 'Unknown Album';

      let genreName = file.genre ? String(file.genre).trim() : null;

      // จดบันทึกชื่อใหม่ที่ยังไม่มีใน Database
      if (!artistMap.has(artistName.toLowerCase())) newArtists.add(artistName);
      if (!albumMap.has(albumName.toLowerCase())) newAlbums.add(albumName);
      if (genreName && !genreMap.has(genreName.toLowerCase())) newGenres.add(genreName);

      // คำนวณความยาวเพลง
      let durationStr = '00:00:00';
      if (file.length) {
        if (String(file.length).includes(':')) {
           durationStr = String(file.length).split(':').length === 2 ? `00:${file.length}` : String(file.length);
        } else {
           const totalSec = parseFloat(file.length);
           if (!isNaN(totalSec)) {
               const h = Math.floor(totalSec / 3600);
               const m = Math.floor((totalSec % 3600) / 60);
               const s = Math.floor(totalSec % 60);
               durationStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
           }
        }
      }

      parsedTracks.push({ title: cleanTitle, duration: durationStr, isFree: true, audioUrl, artistName, albumName, genreName });
    }

    if (parsedTracks.length === 0) return c.json({ success: true, count: 0, message: 'ไม่มีเพลงใหม่ให้ซิงค์' });

    // --- 🚀 3. สร้าง Artist/Album/Genre ใหม่ลง Database รวดเดียว ---
    console.log(`✨ พบศิลปินใหม่ ${newArtists.size} คน, อัลบั้มใหม่ ${newAlbums.size} อัลบั้ม`);
    
    if (newArtists.size > 0) {
        const inserted = await db.insert(artists).values(Array.from(newArtists).map(name => ({ name }))).returning();
        inserted.forEach(a => artistMap.set(a.name.toLowerCase(), a.id)); // อัปเดต Map
    }
    if (newAlbums.size > 0) {
        const inserted = await db.insert(albums)
            .values(Array.from(newAlbums).map(title => ({ 
                title, 
                imgUrl: defaultAlbumCover // ใส่รูปปกให้ทุกอัลบั้มใน Collection นี้
            })))
            .returning();
        inserted.forEach(a => albumMap.set(a.title.toLowerCase(), a.id));
      }
    if (newGenres.size > 0) {
        const inserted = await db.insert(genres).values(Array.from(newGenres).map(name => ({ name }))).returning();
        inserted.forEach(g => genreMap.set(g.name.toLowerCase(), g.id));
    }

    // --- 🚀 4. Batch Insert เพลงและผูกความสัมพันธ์ (M:N) ---
    const BATCH_SIZE = 500;
    let count = 0;

    for (let i = 0; i < parsedTracks.length; i += BATCH_SIZE) {
      const chunk = parsedTracks.slice(i, i + BATCH_SIZE);
      
      // 4.1 Insert ตารางหลัก (Tracks)
      const insertedTracks = await db.insert(tracks).values(chunk.map(t => ({
          title: t.title, duration: t.duration, isFree: t.isFree, audioUrl: t.audioUrl
      }))).returning({ id: tracks.id, audioUrl: tracks.audioUrl });

      const trackArtistsData: any[] = [];
      const trackAlbumsData: any[] = [];
      const trackGenresData: any[] = [];

      // 4.2 จับคู่ ID เพลง กับ ID ศิลปิน/อัลบั้ม
      for (let j = 0; j < chunk.length; j++) {
          const dbTrack = insertedTracks[j];
          const parsed = chunk[j];

          const aId = artistMap.get(parsed.artistName.toLowerCase());
          const alId = albumMap.get(parsed.albumName.toLowerCase());
          const gId = parsed.genreName ? genreMap.get(parsed.genreName.toLowerCase()) : null;

          if (aId) trackArtistsData.push({ trackId: dbTrack.id, artistId: aId });
          if (alId) trackAlbumsData.push({ trackId: dbTrack.id, albumId: alId });
          if (gId) trackGenresData.push({ trackId: dbTrack.id, genreId: gId });
      }

      // 4.3 ยิงข้อมูลความสัมพันธ์เข้า DB
      if (trackArtistsData.length) await db.insert(trackArtists).values(trackArtistsData);
      if (trackAlbumsData.length) await db.insert(trackAlbums).values(trackAlbumsData);
      if (trackGenresData.length) await db.insert(trackGenres).values(trackGenresData);

      count += chunk.length;
      console.log(`📦 นำเข้าสำเร็จ ${count} / ${parsedTracks.length} ...`);
    }

    return c.json({ success: true, count, message: `ซิงค์สำเร็จ ${count} เพลง พร้อมแยก Metadata อัตโนมัติ!` });
  } catch (error) {
    console.error("🔥 IA Sync Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 19. API ดึงรายการเพลงที่ผู้ใช้กดถูกใจ ---
app.get('/api/users/:id/likes', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ดึงเฉพาะ ID เพลงมาเป็น Array ให้อ่านง่ายๆ บน Frontend
    const userLikes = await db.select({ trackId: likeSongs.trackId }).from(likeSongs).where(eq(likeSongs.userId, userId));
    const likedTrackIds = userLikes.map(l => l.trackId);

    return c.json({ success: true, data: likedTrackIds });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 20. API สำหรับกด Like / Unlike เพลง ---
app.post('/api/tracks/:id/like', async (c) => {
  try {
    const trackId = c.req.param('id');
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: 'ต้อง Login ก่อน' }, 401);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // เช็กว่าเคยถูกใจเพลงนี้หรือยัง
    const existingLike = await db.select().from(likeSongs)
      .where(and(eq(likeSongs.userId, userId), eq(likeSongs.trackId, trackId)));

    if (existingLike.length > 0) {
      // ถ้ามีแล้ว -> ให้ลบออก (Unlike)
      await db.delete(likeSongs).where(and(eq(likeSongs.userId, userId), eq(likeSongs.trackId, trackId)));
      return c.json({ success: true, liked: false });
    } else {
      // ถ้ายังไม่มี -> ให้เพิ่มเข้าไป (Like)
      await db.insert(likeSongs).values({ userId, trackId });
      return c.json({ success: true, liked: true });
    }
  } catch (error) {
    console.error("🔥 Like Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 21. API ดึงข้อมูลเพลงโปรดทั้งหมดของผู้ใช้ (พร้อมรายละเอียด) ---
app.get('/api/users/:id/favorites', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ดึงข้อมูลเพลงที่ถูกใจ พร้อม JOIN ตาราง tracks
    const likedTracksRaw = await db.select({
      track: tracks
    })
    .from(likeSongs)
    .innerJoin(tracks, eq(likeSongs.trackId, tracks.id))
    .where(eq(likeSongs.userId, userId))
    .orderBy(desc((likeSongs as any).createdAt || tracks.id)); // เรียงตามเพลงที่เพิ่งกดไลก์ หรือ ID 

    if (likedTracksRaw.length === 0) {
      return c.json({ success: true, data: [] });
    }

    // 2. ดึง Relations (ศิลปิน แนวเพลง อัลบั้ม) แบบ Batch เพื่อความเร็ว
    const trackIds = likedTracksRaw.map(lt => lt.track.id);
    
    const [tArtists, tGenres, tAlbums, allArtists, allGenres, allAlbums] = await Promise.all([
      db.select().from(trackArtists).where(inArray((trackArtists as any).trackId || (trackArtists as any).track_id, trackIds)),
      db.select().from(trackGenres).where(inArray((trackGenres as any).trackId || (trackGenres as any).track_id, trackIds)),
      db.select().from(trackAlbums).where(inArray((trackAlbums as any).trackId || (trackAlbums as any).track_id, trackIds)),
      db.select().from(artists),
      db.select().from(genres),
      db.select().from(albums)
    ]);

    // 3. ประกอบร่างข้อมูลให้พร้อมแสดงผล
    const enrichedFavorites = likedTracksRaw.map(lt => {
      const track = lt.track;
      const tId = track.id;
      const tArtistIds = tArtists.filter(ta => (ta as any).trackId === tId || (ta as any).track_id === tId).map(ta => (ta as any).artistId || (ta as any).artist_id);
      const tGenreIds = tGenres.filter(tg => (tg as any).trackId === tId || (tg as any).track_id === tId).map(tg => (tg as any).genreId || (tg as any).genre_id);
      const trackAlbumRel = tAlbums.find(ta => (ta as any).trackId === tId || (ta as any).track_id === tId);

      return {
        ...track,
        artists: allArtists.filter(a => tArtistIds.includes(a.id)),
        genres: allGenres.filter(g => tGenreIds.includes(g.id)),
        album: trackAlbumRel ? allAlbums.find(a => a.id === ((trackAlbumRel as any).albumId || (trackAlbumRel as any).album_id)) : null
      };
    });

    return c.json({ success: true, data: enrichedFavorites });
  } catch (error) {
    console.error("🔥 Get Favorites Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 22. API บันทึกการเล่นเพลง (เพิ่มยอดวิว + บันทึกประวัติ) ---
app.post('/api/tracks/:id/play', async (c) => {
  try {
    const trackId = c.req.param('id');
    const { userId } = await c.req.json(); // อาจจะส่งมา หรือไม่ส่งก็ได้ (เผื่อคนไม่ล็อกอินก็ให้นับวิว)

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. เพิ่มยอดวิวให้เพลงนั้น +1
    await db.update(tracks)
      .set({ viewCount: drizzleSql`${tracks.viewCount} + 1` })
      .where(eq(tracks.id, trackId));

    // 2. ถ้ามีการล็อกอิน ให้บันทึกลงตาราง histories ด้วย
    if (userId) {
      await db.insert(histories).values({
        userId,
        trackId,
        playedAt: new Date()
      });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("🔥 Play History Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 23. API ดึงประวัติการฟังล่าสุดของผู้ใช้ (Recently Played) ---
app.get('/api/users/:id/history', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ใช้ db.select() เปล่าๆ ป้องกันปัญหา Column Undefined 
    // และรองรับทั้ง camelCase และ snake_case แบบครอบจักรวาล
    const rawHistory = await db.select()
      .from(histories)
      .innerJoin(tracks, eq((histories as any).trackId || (histories as any).track_id, tracks.id))
      .where(eq((histories as any).userId || (histories as any).user_id, userId))
      .orderBy(desc(histories.id)) // เรียงจาก ID ใหม่ไปเก่า (ไม่ต้องพึ่ง playedAt)
      .limit(30);

    const uniqueTracks = [];
    const seenTrackIds = new Set();
    
    for (const item of rawHistory) {
      // Drizzle จะคืนค่ามาเป็นก้อน { histories: {...}, tracks: {...} }
      const trackData = item.tracks; 
      
      if (trackData && !seenTrackIds.has(trackData.id)) {
        seenTrackIds.add(trackData.id);
        uniqueTracks.push(trackData);
      }
      if (uniqueTracks.length >= 10) break; // เอาแค่ 10 เพลงล่าสุด
    }

    return c.json({ success: true, data: uniqueTracks });
  } catch (error) {
    console.error("🔥 Get History Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 25. API ดึงอัลบั้มจัดกลุ่มตามศิลปิน (พร้อมระบบค้นหาและ Pagination) ---
app.get('/api/albums/grouped', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '15');
    const search = c.req.query('search') || ''; // 👇 รับค่าคำค้นหา
    const offset = (page - 1) * limit;

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. สร้างเงื่อนไขการค้นหา (ค้นหาจากชื่อศิลปิน หรือ ชื่ออัลบั้ม)
    let artistCond = undefined;
    if (search) {
        const searchPattern = `%${search}%`;
        
        // หา ID ศิลปินที่มีอัลบั้มตรงกับคำค้นหา
        const matchingAlbumsSubq = db.select({ artistId: (trackArtists as any).artistId || (trackArtists as any).artist_id })
          .from(trackArtists)
          .innerJoin(trackAlbums, eq((trackArtists as any).trackId || (trackArtists as any).track_id, (trackAlbums as any).trackId || (trackAlbums as any).track_id))
          .innerJoin(albums, eq((trackAlbums as any).albumId || (trackAlbums as any).album_id, albums.id))
          .where(ilike(albums.title, searchPattern));

        // ค้นหา: ชื่อศิลปินตรง OR มีอัลบั้มที่ชื่อตรง
        artistCond = or(
            ilike(artists.name, searchPattern),
            inArray(artists.id, matchingAlbumsSubq)
        );
    }

    // 2. ดึงศิลปินมาตาม Limit และเงื่อนไขการค้นหา
    const artistList = await db.select()
        .from(artists)
        .where(artistCond)
        .orderBy(artists.name)
        .limit(limit)
        .offset(offset);

    if (artistList.length === 0) {
        return c.json({ success: true, data: [], hasMore: false });
    }

    const artistIds = artistList.map(a => a.id);

    // 3. โยงหา Album ผ่านตาราง Tracks (ใช้ groupBy เพื่อป้องกันข้อมูลซ้ำจนทะลุ 64MB Limit)
    const rawAlbums = await db.select({
        artistId: (trackArtists as any).artistId || (trackArtists as any).artist_id,
        albumId: albums.id,
        albumTitle: albums.title,
        albumImgUrl: albums.imgUrl || (albums as any).img_url
    })
    .from(trackArtists)
    .innerJoin(trackAlbums, eq((trackArtists as any).trackId || (trackArtists as any).track_id, (trackAlbums as any).trackId || (trackAlbums as any).track_id))
    .innerJoin(albums, eq((trackAlbums as any).albumId || (trackAlbums as any).album_id, albums.id))
    .where(inArray((trackArtists as any).artistId || (trackArtists as any).artist_id, artistIds))
    // 👇 เพิ่ม groupBy ตรงนี้! สั่งให้ Postgres ยุบรวมข้อมูลที่หน้าตาเหมือนกันให้เหลือบรรทัดเดียว
    .groupBy(
        (trackArtists as any).artistId || (trackArtists as any).artist_id,
        albums.id,
        albums.title,
        albums.imgUrl || (albums as any).img_url
    );
    
    // 4. จัดกลุ่มข้อมูลอัลบั้มเข้าหาศิลปิน
    const result = artistList.map(artist => {
        const myRawAlbums = rawAlbums.filter(a => a.artistId === artist.id);
        const uniqueAlbumsMap = new Map();
        
        for (const a of myRawAlbums) {
            // 👇 ถ้ามีการค้นหา ให้กรองอัลบั้มด้วย เพื่อโชว์เฉพาะอัลบั้มที่ตรง
            if (search) {
                const matchArtist = artist.name.toLowerCase().includes(search.toLowerCase());
                const matchAlbum = a.albumTitle.toLowerCase().includes(search.toLowerCase());
                // ถ้าชื่อศิลปินไม่ตรง และชื่ออัลบั้มไม่ตรง ให้ซ่อนอัลบั้มนี้ไป
                if (!matchArtist && !matchAlbum) continue; 
            }
            
            if (!uniqueAlbumsMap.has(a.albumId)) {
                uniqueAlbumsMap.set(a.albumId, { id: a.albumId, title: a.albumTitle, imgUrl: a.albumImgUrl });
            }
        }

        return {
            id: artist.id,
            name: artist.name,
            albums: Array.from(uniqueAlbumsMap.values())
        };
    }).filter(artist => artist.albums.length > 0);

    return c.json({ success: true, data: result, hasMore: artistList.length === limit });
  } catch (error) {
    console.error("🔥 Grouped Albums Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 24. API ดึงรายละเอียดอัลบั้มพร้อมรายชื่อเพลงทั้งหมดในอัลบั้มนั้น ---
app.get('/api/albums/:id', async (c) => {
  try {
    const albumId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ดึงข้อมูล Metadata ของอัลบั้ม
    const albumInfo = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
    if (albumInfo.length === 0) return c.json({ success: false, error: 'ไม่พบอัลบั้ม' }, 404);

    // 2. ดึงรายชื่อเพลงที่อยู่ในอัลบั้มนี้
    const albumTracksRaw = await db.select({
      track: tracks
    })
    .from(trackAlbums)
    .innerJoin(tracks, eq(trackAlbums.trackId, tracks.id))
    .where(eq(trackAlbums.albumId, albumId))
    .orderBy(asc(tracks.id)); // เรียงตาม ID หรือจะเพิ่มคอลัมน์ position ใน SQL ภายหลังก็ได้ครับ

    if (albumTracksRaw.length === 0) {
      return c.json({ success: true, album: albumInfo[0], tracks: [] });
    }

    // 3. ดึง Relations (ศิลปิน, แนวเพลง) ของเพลงในอัลบั้มนี้มาแสดงด้วย
    const trackIds = albumTracksRaw.map(at => at.track.id);
    const [tArtists, tGenres, allArtists, allGenres] = await Promise.all([
      db.select().from(trackArtists).where(inArray((trackArtists as any).trackId || (trackArtists as any).track_id, trackIds)),
      db.select().from(trackGenres).where(inArray((trackGenres as any).trackId || (trackGenres as any).track_id, trackIds)),
      db.select().from(artists),
      db.select().from(genres)
    ]);

    const enrichedTracks = albumTracksRaw.map(at => {
      const track = at.track;
      const tId = track.id;
      const tArtistIds = tArtists.filter(ta => (ta as any).trackId === tId || (ta as any).track_id === tId).map(ta => (ta as any).artistId || (ta as any).artist_id);
      const tGenreIds = tGenres.filter(tg => (tg as any).trackId === tId || (tg as any).track_id === tId).map(tg => (tg as any).genreId || (tg as any).genre_id);

      return {
        ...track,
        artists: allArtists.filter(a => tArtistIds.includes(a.id)),
        genres: allGenres.filter(g => tGenreIds.includes(g.id)),
        album: albumInfo[0] // แปะข้อมูลอัลบั้มกลับเข้าไปเพื่อให้ Player แสดงรูปปกได้
      };
    });

    return c.json({ success: true, album: albumInfo[0], tracks: enrichedTracks });
  } catch (error) {
    console.error("🔥 Get Album Details Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;