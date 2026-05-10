import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users, tracks, histories, artists, genres, trackArtists, trackGenres, playlists, playlistTracks, albums, trackAlbums, likeSongs, items, artistItems, purchaseTransactions, transactionItems, subscriptions, userSubscriptions, artistFollows, admins, logs, albumArtists } from './schema';
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
    const userId = body['userId'] as string | undefined;

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

    if (userId) {
      await insertAuditLog(db, 'user', 'create', `Uploaded track ${title} (${trackId})`, userId);
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
    const { email, username, password, displayName, pfpUrl } = await c.req.json();
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
      displayName: displayName || username,
      pfpUrl: pfpUrl || null
    }).returning({ id: users.id, username: users.username, displayName: users.displayName, pfpUrl: users.pfpUrl });

    await insertAuditLog(db, 'user', 'create', `New account registered: ${username}`, newUser[0].id);

    return c.json({ success: true, user: newUser[0] });
  } catch (error) {
    console.error("🔥 Register Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 10. API เข้าสู่ระบบ (อัปเกรดการเช็ก Status) ---
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const targetUsers = await db.select().from(users).where(eq(users.username, username));
    if (targetUsers.length === 0) return c.json({ error: 'ไม่พบผู้ใช้งานนี้' }, 401);

    const user = targetUsers[0];

    // 👇 1. ตรวจสอบสถานะบัญชีก่อน (อิงตาม ENUM account_status_enum)
    if (user.accountStatus === 'suspended') {
      return c.json({ error: 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อฝ่ายสนับสนุน' }, 403);
    }
    if (user.accountStatus === 'deleted') {
      return c.json({ error: 'บัญชีนี้ถูกลบออกจากระบบแล้ว' }, 410);
    }

    const hashedPassword = await hashPassword(password);
    if (user.passwordHash !== hashedPassword) {
      return c.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    }

    await insertAuditLog(db, 'user', 'login', `User ${user.username} logged in`, user.id);

    return c.json({ 
      success: true, 
      user: { id: user.id, username: user.username, email: user.email, displayName: user.displayName, pfpUrl: user.pfpUrl || (user as any).pfp_url } 
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

    await insertAuditLog(db, 'user', 'create', `Created new playlist: ${name}`, userId);

    return c.json({ success: true, data: newPlaylist[0] });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 13. API เพิ่มเพลงเข้าเพลย์ลิสต์ ---
app.post('/api/playlists/:id/tracks', async (c) => {
  try {
    const playlistId = c.req.param('id');
    const { trackId, userId } = await c.req.json();

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

    if (userId) {
      await insertAuditLog(db, 'user', 'update', `Added track ${trackId} to playlist ${playlistId}`, userId);
    }

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
    
    // ดึงเฉพาะข้อมูลอัลบั้มเพียวๆ (ไม่ Join กับศิลปินทั้งหมดแล้ว เพื่อป้องกัน Memory/64MB Limit พัง)
    const allAlbums = await db.select({
      id: albums.id,
      title: albums.title,
      imgUrl: albums.imgUrl || (albums as any).img_url
    })
    .from(albums)
    .orderBy(desc(albums.id));
    
    return c.json({ success: true, data: allAlbums });
  } catch (error) {
    // 👇 เพิ่ม console.error เพื่อให้เห็นสาเหตุชัดเจนเวลาพัง
    console.error("🔥 Get Albums Error:", error); 
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 16. API สร้างอัลบั้มใหม่ ---
app.post('/api/albums', async (c) => {
  try {
    const { title, imgUrl, releaseDate, artistIds, userId, adminId } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const newAlbum = await db.insert(albums).values({
      title,
      imgUrl: imgUrl || null,
      releaseDate: releaseDate ? new Date(releaseDate).toISOString() : new Date().toISOString()
    }).returning();

    const albumId = newAlbum[0].id;

    if (artistIds && Array.isArray(artistIds) && artistIds.length > 0) {
      await db.insert(albumArtists).values(
        artistIds.map((id: string) => ({ albumId, artistId: id }))
      );
    }

    if (userId) {
      await insertAuditLog(db, 'user', 'create', `Created album ${title}`, userId);
    } else if (adminId) {
      await insertAuditLog(db, 'admin', 'create', `Created album ${title}`, undefined, adminId);
    }

    return c.json({ success: true, data: newAlbum[0] });
  } catch (error) {
    console.error("🔥 Create Album Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 17. API สร้างศิลปิน และ แนวเพลง (Quick Add) ---
app.post('/api/artists', async (c) => {
  const { name, userId, adminId } = await c.req.json();
  const db = drizzle(neon(c.env.DATABASE_URL));
  const newArtist = await db.insert(artists).values({ name }).returning();

  if (userId) {
    await insertAuditLog(db, 'user', 'create', `Created artist ${name}`, userId);
  } else if (adminId) {
    await insertAuditLog(db, 'admin', 'create', `Created artist ${name}`, undefined, adminId);
  }

  return c.json({ success: true, data: newArtist[0] });
});

app.post('/api/genres', async (c) => {
  const { name, userId, adminId } = await c.req.json();
  const db = drizzle(neon(c.env.DATABASE_URL));
  const newGenre = await db.insert(genres).values({ name }).returning();

  if (userId) {
    await insertAuditLog(db, 'user', 'create', `Created genre ${name}`, userId);
  } else if (adminId) {
    await insertAuditLog(db, 'admin', 'create', `Created genre ${name}`, undefined, adminId);
  }

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
      await insertAuditLog(db, 'user', 'delete', `Unliked track ${trackId}`, userId);
      return c.json({ success: true, liked: false });
    } else {
      // ถ้ายังไม่มี -> ให้เพิ่มเข้าไป (Like)
      await db.insert(likeSongs).values({ userId, trackId });
      await insertAuditLog(db, 'user', 'create', `Liked track ${trackId}`, userId);
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
        listenedAt: new Date()
      });
      await insertAuditLog(db, 'user', 'other', `Played track ${trackId}`, userId);
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

    const aArtistsRaw = await db.select().from(albumArtists).where(eq((albumArtists as any).albumId || (albumArtists as any).album_id, albumId));
    let albumArtistsList: any[] = [];
    if (aArtistsRaw.length > 0) {
      const aArtistIds = aArtistsRaw.map(aa => (aa as any).artistId || (aa as any).artist_id);
      albumArtistsList = await db.select().from(artists).where(inArray(artists.id, aArtistIds));
    }

    const fullAlbum = { ...albumInfo[0], artists: albumArtistsList };

    // 2. ดึงรายชื่อเพลงที่อยู่ในอัลบั้มนี้
    const albumTracksRaw = await db.select({
      track: tracks
    })
    .from(trackAlbums)
    .innerJoin(tracks, eq(trackAlbums.trackId, tracks.id))
    .where(eq(trackAlbums.albumId, albumId))
    .orderBy(asc(tracks.id)); // เรียงตาม ID หรือจะเพิ่มคอลัมน์ position ใน SQL ภายหลังก็ได้ครับ

    if (albumTracksRaw.length === 0) {
      return c.json({ success: true, album: fullAlbum, tracks: [] });
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
        album: fullAlbum // แปะข้อมูลอัลบั้มกลับเข้าไปเพื่อให้ Player แสดงรูปปกได้
      };
    });

    return c.json({ success: true, album: fullAlbum, tracks: enrichedTracks });
  } catch (error) {
    console.error("🔥 Get Album Details Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 26. API ดึงสินค้า (Merchandise) พร้อมข้อมูลศิลปิน ---
app.get('/api/merch', async (c) => {
  try {
    const search = c.req.query('search') || '';
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    let conditions = undefined;
    if (search) {
      conditions = ilike(items.name, `%${search}%`);
    }

    const allItems = await db.select().from(items).where(conditions).orderBy(desc(items.id));

    if (allItems.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const itemIds = allItems.map(i => i.id);

    // ดึงความสัมพันธ์กับศิลปิน
    const [iArtists, allArtists] = await Promise.all([
      db.select().from(artistItems).where(inArray((artistItems as any).itemId || (artistItems as any).item_id, itemIds)),
      db.select().from(artists)
    ]);

    const enrichedItems = allItems.map(item => {
      const iId = item.id;
      const associatedArtistIds = iArtists.filter(ai => ((ai as any).itemId || (ai as any).item_id) === iId).map(ai => (ai as any).artistId || (ai as any).artist_id);
      return {
        ...item,
        artists: allArtists.filter(a => associatedArtistIds.includes(a.id))
      };
    });

    return c.json({ success: true, data: enrichedItems });
  } catch (error) {
    console.error("🔥 Merch List Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 27. API ดึงรายละเอียดสินค้า (Merchandise) ---
app.get('/api/merch/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const targetItems = await db.select().from(items).where(eq(items.id, id));
    if (targetItems.length === 0) return c.json({ success: false, error: 'Item not found' }, 404);

    const item = targetItems[0];
    
    const iArtists = await db.select().from(artistItems).where(eq((artistItems as any).itemId || (artistItems as any).item_id, id));
    const artistIds = iArtists.map(ai => (ai as any).artistId || (ai as any).artist_id);
    
    let relatedArtists: typeof artists.$inferSelect[] = [];
    if (artistIds.length > 0) {
      relatedArtists = await db.select().from(artists).where(inArray(artists.id, artistIds));
    }

    return c.json({ success: true, data: { ...item, artists: relatedArtists } });
  } catch (error) {
    console.error("🔥 Merch Details Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 28. API สำหรับทำรายการสั่งซื้อ (Checkout) ---
app.post('/api/merch/checkout', async (c) => {
  try {
    const { userId, cart } = await c.req.json();
    if (!userId || !cart || cart.length === 0) {
      return c.json({ success: false, error: 'Invalid checkout data' }, 400);
    }

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    let totalItemCount = 0;
    let totalPrice = 0;

    const cartItemIds = cart.map((cItem: any) => cItem.itemId);
    const dbItems = await db.select().from(items).where(inArray(items.id, cartItemIds));
    
    const validatedCart = cart.map((cItem: any) => {
      const dbItem = dbItems.find(i => i.id === cItem.itemId);
      if (!dbItem) throw new Error(`Item ${cItem.itemId} not found`);
      const quantity = parseInt(cItem.quantity) || 1;
      const unitPrice = parseFloat(dbItem.price as any);
      totalItemCount += quantity;
      totalPrice += quantity * unitPrice;
      
      return {
        itemId: dbItem.id,
        unitPrice,
        quantity
      };
    });

    const newTx = await db.insert(purchaseTransactions).values({
      userId,
      totalItemCount,
      totalPrice: String(totalPrice)
    }).returning();

    const tranId = newTx[0].id;

    await db.insert(transactionItems).values(
      validatedCart.map((vc: any) => ({
        tranId,
        itemId: vc.itemId,
        unitPrice: String(vc.unitPrice),
        quantity: vc.quantity
      }))
    );

    await insertAuditLog(db, 'user', 'create', `Checkout transaction ${tranId} total ${totalPrice}`, userId);

    return c.json({ success: true, message: 'Checkout successful', transaction: newTx[0] });
  } catch (error) {
    console.error("🔥 Checkout Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 29. API ดึงรายการแพ็กเกจสมาชิก (Subscriptions) ---
app.get('/api/subscriptions', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const plans = await db.select().from(subscriptions).orderBy(asc(subscriptions.price));
    return c.json({ success: true, data: plans });
  } catch (error) {
    console.error("🔥 Subscriptions List Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 30. API สำหรับสมัครแพ็กเกจสมาชิก (Subscribe) ---
app.post('/api/subscriptions/subscribe', async (c) => {
  try {
    const { userId, subscriptionId } = await c.req.json();
    if (!userId || !subscriptionId) {
      return c.json({ success: false, error: 'Missing userId or subscriptionId' }, 400);
    }

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ดึงข้อมูลแพ็กเกจเพื่อเอาจำนวนวัน
    const plans = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    if (plans.length === 0) {
      return c.json({ success: false, error: 'Subscription plan not found' }, 404);
    }
    const plan = plans[0];

    // คำนวณวันหมดอายุ
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(startDate.getDate() + plan.durationDays);

    // ตรวจสอบว่าผู้ใช้มีแพ็กเกจที่กำลังใช้งานอยู่หรือไม่
    const activeSub = await db.select().from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          drizzleSql`expiry_date > now()`
        )
      )
      .orderBy(desc(userSubscriptions.expiryDate))
      .limit(1);

    if (activeSub.length > 0) {
      // หากมีแพ็กเกจอยู่แล้ว ให้ต่ออายุจากวันหมดอายุเดิม
      const currentExpiry = new Date(activeSub[0].expiryDate);
      expiryDate.setTime(currentExpiry.getTime());
      expiryDate.setDate(expiryDate.getDate() + plan.durationDays);
    }

    // บันทึกการสมัคร
    const newSub = await db.insert(userSubscriptions).values({
      userId,
      subscriptionId,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString()
    }).returning();

    await insertAuditLog(db, 'user', 'update', `Subscribed to ${plan.name}`, userId);

    return c.json({ success: true, data: newSub[0], message: 'Subscription activated' });
  } catch (error) {
    console.error("🔥 Subscribe Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 31. API ตรวจสอบสถานะสมาชิก (อัปเกรด: คำนวณวันหมดอายุ) ---
app.get('/api/users/:id/subscription', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const activeSubs = await db.select({
      userSub: userSubscriptions,
      plan: subscriptions
    })
    .from(userSubscriptions)
    .innerJoin(subscriptions, eq(userSubscriptions.subscriptionId, subscriptions.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        drizzleSql`expiry_date > now()`
      )
    )
    .orderBy(desc(userSubscriptions.expiryDate))
    .limit(1);

    if (activeSubs.length === 0) {
      return c.json({ success: true, data: null, isActive: false });
    }

    const sub = activeSubs[0];
    const expiryDate = new Date(sub.userSub.expiryDate);
    const now = new Date();
    
    // คำนวณจำนวนวันที่เหลือ
    const diffTime = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return c.json({ 
      success: true, 
      data: {
        ...sub,
        daysRemaining,
        isExpiringSoon: daysRemaining <= 7 // แจ้งเตือนถ้าเหลือน้อยกว่าหรือเท่ากับ 7 วัน
      }, 
      isActive: true 
    });
  } catch (error) {
    console.error("🔥 Check Subscription Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 32. API สำหรับกดติดตาม / เลิกติดตามศิลปิน (Follow / Unfollow) ---
app.post('/api/artists/:id/follow', async (c) => {
  try {
    const artistId = c.req.param('id');
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: 'ต้อง Login ก่อน' }, 401);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const existingFollow = await db.select().from(artistFollows)
      .where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, artistId)));

    if (existingFollow.length > 0) {
      await db.delete(artistFollows).where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, artistId)));
      await insertAuditLog(db, 'user', 'delete', `Unfollowed artist ${artistId}`, userId);
      return c.json({ success: true, followed: false });
    } else {
      await db.insert(artistFollows).values({ userId, artistId });
      await insertAuditLog(db, 'user', 'create', `Followed artist ${artistId}`, userId);
      return c.json({ success: true, followed: true });
    }
  } catch (error) {
    console.error("🔥 Follow Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 33. API ดึงข้อมูลศิลปินที่ผู้ใช้งานติดตาม ---
app.get('/api/users/:id/follows', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const followedArtistsRaw = await db.select({
      artist: artists
    })
    .from(artistFollows)
    .innerJoin(artists, eq(artistFollows.artistId, artists.id))
    .where(eq(artistFollows.userId, userId))
    .orderBy(artists.name);

    const followedArtists = followedArtistsRaw.map(fa => fa.artist);

    return c.json({ success: true, data: followedArtists });
  } catch (error) {
    console.error("🔥 Get Follows Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 34. API สำหรับ Admin Login ---
app.post('/api/admin/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const targetAdmins = await db.select().from(admins).where(eq(admins.username, username));
    if (targetAdmins.length === 0) return c.json({ error: 'ไม่พบผู้ดูแลระบบนี้' }, 401);

    const admin = targetAdmins[0];
    const hashedPassword = await hashPassword(password);

    if (admin.passwordHash !== hashedPassword) {
      return c.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    }

    await insertAuditLog(db, 'admin', 'login', 'Admin logged in', undefined, admin.id);

    return c.json({ 
      success: true, 
      admin: { id: admin.id, username: admin.username } 
    });
  } catch (error) {
    console.error("🔥 Admin Login Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 35. API ดึงข้อมูล Audit Logs ทั้งหมด ---
app.get('/api/logs', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ดึง Logs พร้อม JOIN ตาราง Users และ Admins เพื่อเอาชื่อมาแสดง
    const allLogs = await db.select({
      log: logs,
      user: { id: users.id, username: users.username },
      admin: { id: admins.id, username: admins.username }
    })
    .from(logs)
    .leftJoin(users, eq(logs.userId, users.id))
    .leftJoin(admins, eq(logs.adminId, admins.id))
    .orderBy(desc(logs.createdAt));

    const formattedLogs = allLogs.map(item => ({
      id: item.log.id,
      actorType: item.log.actorType,
      actionType: item.log.actionType,
      actionDetail: item.log.actionDetail,
      createdAt: item.log.createdAt,
      actorName: item.log.actorType === 'admin' ? item.admin?.username : item.user?.username
    }));

    return c.json({ success: true, data: formattedLogs });
  } catch (error) {
    console.error("🔥 Get Logs Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 36. API สร้าง Audit Log (สำหรับบันทึก action ต่างๆ ในระบบ) ---
app.post('/api/logs', async (c) => {
  try {
    const { actorType, actionType, actionDetail, userId, adminId } = await c.req.json();

    // ตรวจสอบเงื่อนไข Actor ตาม Constraint ใน Database
    if (actorType === 'user' && (!userId || adminId)) {
       return c.json({ error: 'Invalid actor constraints for user' }, 400);
    }
    if (actorType === 'admin' && (!adminId || userId)) {
       return c.json({ error: 'Invalid actor constraints for admin' }, 400);
    }

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const newLog = await db.insert(logs).values({
      actorType,
      actionType,
      actionDetail,
      userId: userId || null,
      adminId: adminId || null
    }).returning();

    return c.json({ success: true, data: newLog[0] });
  } catch (error) {
    console.error("🔥 Create Log Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- API พิเศษ: สร้าง Mock สินค้าสำหรับทดสอบระบบ Merch ---
// (แนะนำให้ลบหรือคอมเมนต์ทิ้งเมื่อโปรเจกต์พร้อมขึ้น Production จริง)
app.post('/api/merch/seed', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ดึงรายชื่อศิลปินมาสัก 20 คน (เพื่อไม่ให้สินค้าเยอะเกินไปจนเทสต์ลำบาก)
    const artistList = await db.select().from(artists).limit(20);

    if (artistList.length === 0) {
      return c.json({ success: false, error: 'ไม่พบรายชื่อศิลปินในระบบ กรุณา Sync IA ก่อน' }, 404);
    }

    let createdCount = 0;

    // 2. วนลูปสร้างสินค้าให้ศิลปินแต่ละคน
    for (const artist of artistList) {
      // โครงสร้างสินค้าจำลอง (ปรับราคาได้ตามใจชอบ)
      const mockItems = [
        { 
          name: `${artist.name} - Limited Edition Vinyl`, 
          price: '1500.00', 
          img: `https://placehold.co/600x600/1db954/fff?text=${encodeURIComponent('Vinyl\n'+artist.name)}` 
        },
        { 
          name: `${artist.name} Official Tour T-Shirt`, 
          price: '790.00', 
          img: `https://placehold.co/600x600/111111/fff?text=${encodeURIComponent('T-Shirt\n'+artist.name)}` 
        },
        { 
          name: `${artist.name} - Retro Cassette Tape`, 
          price: '350.00', 
          img: `https://placehold.co/600x600/ff7eb3/fff?text=${encodeURIComponent('Cassette\n'+artist.name)}` 
        },
        { 
          name: `${artist.name} - Signed Poster`, 
          price: '250.00', 
          img: `https://placehold.co/400x600/333333/fff?text=${encodeURIComponent('Poster\n'+artist.name)}` 
        }
      ];

      for (const mock of mockItems) {
        // บันทึกลงตาราง items
        const [newItem] = await db.insert(items).values({
          name: mock.name,
          price: mock.price, // เป็น numeric() ใน Schema ต้องส่งเป็น String ป้องกันค่าเพี้ยน
          imgUrl: mock.img
        }).returning();

        // ผูกความสัมพันธ์ลงตาราง M:N (artist_items)
        await db.insert(artistItems).values({
          itemId: newItem.id,
          artistId: artist.id
        });

        createdCount++;
      }
    }

    return c.json({ 
      success: true, 
      message: `เสกสินค้าจำลองสำเร็จ! ได้สินค้าทั้งหมด ${createdCount} ชิ้น จากศิลปิน ${artistList.length} คน` 
    });

  } catch (error) {
    console.error("🔥 Seed Merch Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- API ดึงรายชื่อศิลปินทั้งหมด (พร้อมระบบค้นหาและแบ่งหน้า) ---
app.get('/api/artists/browse', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '30');
    const search = c.req.query('search') || '';
    const offset = (page - 1) * limit;

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    let condition = undefined;
    if (search) {
      condition = ilike(artists.name, `%${search}%`);
    }

    const artistList = await db.select()
      .from(artists)
      .where(condition)
      .orderBy(asc(artists.name)) // เรียงตามตัวอักษร A-Z
      .limit(limit)
      .offset(offset);

    const hasMore = artistList.length === limit;

    return c.json({ success: true, data: artistList, hasMore });
  } catch (error) {
    console.error("🔥 Browse Artists Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- API ดึงรายละเอียดศิลปิน (พร้อม อัลบั้ม และ เพลง) ---
app.get('/api/artists/:id', async (c) => {
  try {
    const artistId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ดึงข้อมูลตัวศิลปิน
    const targetArtists = await db.select().from(artists).where(eq(artists.id, artistId));
    if (targetArtists.length === 0) return c.json({ success: false, error: 'ไม่พบศิลปิน' }, 404);
    const artist = targetArtists[0];

    // 2. ดึงอัลบั้มของศิลปินคนนี้ (ใช้ groupBy เพื่อกันซ้ำ เหมือนตอนทำหน้า Grouped Albums)
    const artistAlbums = await db.select({
        id: albums.id,
        title: albums.title,
        imgUrl: albums.imgUrl || (albums as any).img_url
    })
    .from(trackArtists)
    .innerJoin(trackAlbums, eq((trackArtists as any).trackId || (trackArtists as any).track_id, (trackAlbums as any).trackId || (trackAlbums as any).track_id))
    .innerJoin(albums, eq((trackAlbums as any).albumId || (trackAlbums as any).album_id, albums.id))
    .where(eq((trackArtists as any).artistId || (trackArtists as any).artist_id, artistId))
    .groupBy(albums.id, albums.title, albums.imgUrl || (albums as any).img_url);

    // 3. ดึงเพลงทั้งหมดของศิลปินคนนี้
    const artistTracksRaw = await db.select({ track: tracks })
      .from(trackArtists)
      .innerJoin(tracks, eq((trackArtists as any).trackId || (trackArtists as any).track_id, tracks.id))
      .where(eq((trackArtists as any).artistId || (trackArtists as any).artist_id, artistId))
      .orderBy(desc(tracks.viewCount)); // เอาเพลงฮิตขึ้นก่อน

    // ประกอบร่างเพลงกับข้อมูลอัลบั้มเพื่อให้ Player ทำงานได้สมบูรณ์
    const trackIds = artistTracksRaw.map(t => t.track.id);
    let enrichedTracks = [];
    
    if (trackIds.length > 0) {
      const [tAlbums, allAlbums] = await Promise.all([
         db.select().from(trackAlbums).where(inArray((trackAlbums as any).trackId || (trackAlbums as any).track_id, trackIds)),
         db.select().from(albums)
      ]);

      enrichedTracks = artistTracksRaw.map(t => {
        const track = t.track;
        const trackAlbumRel = tAlbums.find(ta => ((ta as any).trackId || (ta as any).track_id) === track.id);
        return {
          ...track,
          artists: [artist], // ใส่ข้อมูลศิลปินเข้าไปด้วย
          album: trackAlbumRel ? allAlbums.find(a => a.id === ((trackAlbumRel as any).albumId || (trackAlbumRel as any).album_id)) : null
        };
      });
    }

    return c.json({ success: true, artist, albums: artistAlbums, tracks: enrichedTracks });
  } catch (error) {
    console.error("🔥 Artist Details Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- API ดึงประวัติการซื้อสินค้าของ User ---
app.get('/api/users/:id/purchases', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ดึง Transaction ทั้งหมดของ User นี้
    const transactions = await db.select()
      .from(purchaseTransactions)
      .where(eq(purchaseTransactions.userId, userId))
      .orderBy(desc(purchaseTransactions.timePurchase));

    if (transactions.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const tranIds = transactions.map(t => t.id);

    // ดึงรายการสินค้าในทุก Transaction พร้อมข้อมูลชื่อสินค้าจากตาราง items
    const allItemsInTrans = await db.select({
      tranId: transactionItems.tranId,
      itemId: transactionItems.itemId,
      itemName: items.name,
      itemImg: items.imgUrl,
      unitPrice: transactionItems.unitPrice,
      quantity: transactionItems.quantity,
      extendedPrice: transactionItems.extendedPrice
    })
    .from(transactionItems)
    .innerJoin(items, eq(transactionItems.itemId, items.id))
    .where(inArray(transactionItems.tranId, tranIds));

    // ประกอบร่างข้อมูล: ยัด Items ลงไปในแต่ละ Transaction
    const result = transactions.map(t => {
      return {
        ...t,
        items: allItemsInTrans.filter(item => item.tranId === t.id)
      };
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("🔥 Get Purchases Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- API สำหรับ Admin เปลี่ยนสถานะผู้ใช้งาน ---
app.put('/api/admin/users/:id/status', async (c) => {
  try {
    const userId = c.req.param('id');
    const { status, adminId } = await c.req.json(); // รับสถานะใหม่และ ID ของแอดมินที่ทำรายการ
    
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // อัปเดตสถานะในตาราง users
    await db.update(users)
      .set({ accountStatus: status })
      .where(eq(users.id, userId));

    // บันทึกลง Audit Log เพื่อเป็นหลักฐานว่าแอดมินคนไหนเป็นคนแบน
    await insertAuditLog(db, 'admin', 'ban', `Changed status of user ${userId} to ${status}`, undefined, adminId);

    return c.json({ success: true, message: 'อัปเดตสถานะผู้ใช้เรียบร้อย' });
  } catch (error) {
    console.error("🔥 Update User Status Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 37. API Admin: สร้างสินค้าใหม่ (Create Merch) ---
app.post('/api/admin/merch', async (c) => {
  try {
    const { name, price, imgUrl, artistIds, adminId } = await c.req.json();
    if (!name || !price) return c.json({ error: 'กรุณากรอกชื่อและราคาสินค้า' }, 400);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. สร้างสินค้าลงตาราง items
    const [newItem] = await db.insert(items).values({
      name,
      price: String(price), // แปลงเป็น String เพราะ Schema เป็น Decimal/Numeric
      imgUrl: imgUrl || null
    }).returning();

    // 2. ผูกสินค้าเข้ากับศิลปิน (ตาราง artist_items)
    if (artistIds && artistIds.length > 0) {
      await db.insert(artistItems).values(
        artistIds.map((id: string) => ({ itemId: newItem.id, artistId: id }))
      );
    }

    // 3. บันทึก Audit Log
    await insertAuditLog(db, 'admin', 'create', `Created merch item: ${name}`, undefined, adminId);

    return c.json({ success: true, data: newItem });
  } catch (error) {
    console.error("🔥 Create Merch Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 38. API Admin: แก้ไขสินค้า (Update Merch) ---
app.put('/api/admin/merch/:id', async (c) => {
  try {
    const itemId = c.req.param('id');
    const { name, price, imgUrl, artistIds, adminId } = await c.req.json();

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. อัปเดตข้อมูลหลัก
    await db.update(items)
      .set({ name, price: String(price), imgUrl: imgUrl || null })
      .where(eq(items.id, itemId));

    // 2. รีเซ็ตศิลปินที่ผูกไว้ (ลบของเก่า Insert ของใหม่)
    await db.delete(artistItems).where(eq((artistItems as any).itemId || (artistItems as any).item_id, itemId));
    if (artistIds && artistIds.length > 0) {
      await db.insert(artistItems).values(
        artistIds.map((id: string) => ({ itemId, artistId: id }))
      );
    }

    await insertAuditLog(db, 'admin', 'update', `Updated merch item: ${itemId}`, undefined, adminId);

    return c.json({ success: true, message: 'อัปเดตสินค้าเรียบร้อย' });
  } catch (error) {
    console.error("🔥 Update Merch Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 39. API Admin: ลบสินค้า (Delete Merch) ---
app.delete('/api/admin/merch/:id', async (c) => {
  try {
    const itemId = c.req.param('id');
    const { adminId } = await c.req.json();
    
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ลบสินค้าออก (ON DELETE RESTRICT จะทำงานถ้ารหัสสินค้านี้อยู่ใน transaction_items)
    await db.delete(items).where(eq(items.id, itemId));
    await insertAuditLog(db, 'admin', 'delete', `Deleted merch item: ${itemId}`, undefined, adminId);

    return c.json({ success: true, message: 'ลบสินค้าสำเร็จ' });
  } catch (error: any) {
    console.error("🔥 Delete Merch Error:", error);
    // ดักจับ Error จาก PostgreSQL Constraint (ON DELETE RESTRICT)
    if (String(error).includes('transaction_items_item_id_fkey') || String(error).includes('violates foreign key constraint')) {
      return c.json({ 
        success: false, 
        error: 'ไม่สามารถลบสินค้านี้ได้ เนื่องจากมีประวัติลูกค้าสั่งซื้อไปแล้ว (ข้อกำหนดทางบัญชี)' 
      }, 400);
    }
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- ฟังก์ชันช่วยเหลือสำหรับบันทึก Audit Log ให้อัตโนมัติ ---
async function insertAuditLog(
  db: any, 
  actorType: 'user' | 'admin', 
  actionType: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'ban' | 'other', 
  actionDetail: string, 
  userId?: string, 
  adminId?: string
) {
  try {
    await db.insert(logs).values({
      actorType,
      actionType,
      actionDetail,
      userId: userId || null,
      adminId: adminId || null
    });
  } catch (error) {
    console.error("🔥 Auto Log Error:", error);
  }
}

// --- API สำหรับวิเคราะห์สถิติการฟังของผู้ใช้ (Listening Analytics) ---
app.get('/api/users/:id/analytics', async (c) => {
  try {
    const userId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // 1. ดึง Top 5 Artists (ใช้ Index ช่วยกรอง user_id ได้ไวมาก)
    const topArtists = await db.select({
      name: artists.name,
      playCount: drizzleSql`count(*)`.mapWith(Number)
    })
    .from(histories)
    .innerJoin(tracks, eq(histories.trackId, tracks.id))
    .innerJoin(trackArtists, eq(tracks.id, trackArtists.trackId))
    .innerJoin(artists, eq(trackArtists.artistId, artists.id))
    .where(eq(histories.userId, userId))
    .groupBy(artists.id, artists.name)
    .orderBy(desc(drizzleSql`count(*)`))
    .limit(5);

    // 2. ดึง Top 5 Genres
    const topGenres = await db.select({
      name: genres.name,
      playCount: drizzleSql`count(*)`.mapWith(Number)
    })
    .from(histories)
    .innerJoin(tracks, eq(histories.trackId, tracks.id))
    .innerJoin(trackGenres, eq(tracks.id, trackGenres.trackId))
    .innerJoin(genres, eq(trackGenres.genreId, genres.id))
    .where(eq(histories.userId, userId))
    .groupBy(genres.id, genres.name)
    .orderBy(desc(drizzleSql`count(*)`))
    .limit(5);

    // 3. ดึง Trend การฟังในช่วง 7 วันล่าสุด (Grouping by Day)
    const listeningTrend = await db.select({
      date: drizzleSql`DATE(listened_at)`.mapWith(String),
      count: drizzleSql`count(*)`.mapWith(Number)
    })
    .from(histories)
    .where(and(
      eq(histories.userId, userId),
      drizzleSql`listened_at > now() - interval '7 days'`
    ))
    .groupBy(drizzleSql`DATE(listened_at)`)
    .orderBy(asc(drizzleSql`DATE(listened_at)`));

    return c.json({ 
      success: true, 
      data: { topArtists, topGenres, listeningTrend } 
    });
  } catch (error) {
    console.error("🔥 Analytics Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 40. API Admin: ดึงรายการสั่งซื้อทั้งหมด (All Orders) ---
app.get('/api/admin/orders', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ดึงบิลทั้งหมด พร้อม JOIN หาชื่อผู้สั่งซื้อ
    const allOrders = await db.select({
      order: purchaseTransactions,
      user: { 
        id: users.id, 
        username: users.username, 
        displayName: users.displayName 
      }
    })
    .from(purchaseTransactions)
    .innerJoin(users, eq(purchaseTransactions.userId, users.id))
    .orderBy(desc(purchaseTransactions.timePurchase));

    return c.json({ success: true, data: allOrders });
  } catch (error) {
    console.error("🔥 Get All Orders Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 41. API Admin: ยกเลิกคำสั่งซื้อ (Cancel / Delete Order) ---
app.delete('/api/admin/orders/:id', async (c) => {
  try {
    const orderId = c.req.param('id');
    const { adminId } = await c.req.json();
    
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // เช็กว่าบิลนี้มีอยู่จริงไหมก่อนลบ
    const targetOrder = await db.select().from(purchaseTransactions).where(eq(purchaseTransactions.id, orderId));
    if (targetOrder.length === 0) {
      return c.json({ success: false, error: 'ไม่พบคำสั่งซื้อนี้ในระบบ' }, 404);
    }

    // 1. ลบ Transaction หลัก (transaction_items จะถูกลบตามอัตโนมัติด้วย ON DELETE CASCADE)
    await db.delete(purchaseTransactions).where(eq(purchaseTransactions.id, orderId));

    // 2. บันทึกหลักฐานลง Audit Log
    const total = targetOrder[0].totalPrice;
    await insertAuditLog(
      db, 
      'admin', 
      'delete', 
      `Cancelled order ${orderId.slice(0, 8)} (Total: ฿${total})`, 
      undefined, 
      adminId
    );

    return c.json({ success: true, message: 'ยกเลิกคำสั่งซื้อสำเร็จ' });
  } catch (error) {
    console.error("🔥 Cancel Order Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 42. API Admin: จัดอันดับศิลปินยอดนิยม (Social Follows Analytics) ---
app.get('/api/admin/artists/ranking', async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // ดึงข้อมูลศิลปิน พร้อมนับจำนวนผู้ติดตาม 
    // (ใช้ LEFT JOIN เพื่อให้ดึงศิลปินที่ยังไม่มีคนตามมาแสดงด้วย และเรียงตามลำดับจากมากไปน้อย)
    const ranking = await db.select({
      id: artists.id,
      name: artists.name,
      followerCount: drizzleSql`count(${artistFollows.userId})`.mapWith(Number)
    })
    .from(artists)
    .leftJoin(artistFollows, eq(artists.id, artistFollows.artistId))
    .groupBy(artists.id, artists.name)
    .orderBy(desc(drizzleSql`count(${artistFollows.userId})`))
    .limit(20); // แสดง Top 20

    return c.json({ success: true, data: ranking });
  } catch (error) {
    console.error("🔥 Artist Ranking Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 43. API Admin: แก้ไขข้อมูลศิลปิน (Update Artist) ---
app.put('/api/admin/artists/:id', async (c) => {
  try {
    const artistId = c.req.param('id');
    const { name, adminId } = await c.req.json();
    if (!name) return c.json({ error: 'กรุณากรอกชื่อศิลปิน' }, 400);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    await db.update(artists)
      .set({ name })
      .where(eq(artists.id, artistId));

    await insertAuditLog(db, 'admin', 'update', `Updated artist: ${name} (${artistId})`, undefined, adminId);

    return c.json({ success: true, message: 'อัปเดตข้อมูลศิลปินเรียบร้อย' });
  } catch (error) {
    console.error("🔥 Update Artist Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 44. API Admin: ลบศิลปิน (Delete Artist) ---
app.delete('/api/admin/artists/:id', async (c) => {
  try {
    const artistId = c.req.param('id');
    const { adminId } = await c.req.json();

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    // เช็คก่อนว่ามีศิลปินนี้ไหม
    const target = await db.select().from(artists).where(eq(artists.id, artistId));
    if (target.length === 0) return c.json({ error: 'ไม่พบศิลปิน' }, 404);

    await db.delete(artists).where(eq(artists.id, artistId));
    await insertAuditLog(db, 'admin', 'delete', `Deleted artist: ${target[0].name} (${artistId})`, undefined, adminId);

    return c.json({ success: true, message: 'ลบศิลปินเรียบร้อย' });
  } catch (error) {
    console.error("🔥 Delete Artist Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 45. API Admin: แก้ไขข้อมูลอัลบั้ม (Update Album) ---
app.put('/api/admin/albums/:id', async (c) => {
  try {
    const albumId = c.req.param('id');
    const { title, imgUrl, artistIds, adminId } = await c.req.json();
    if (!title) return c.json({ error: 'กรุณากรอกชื่ออัลบั้ม' }, 400);

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    await db.update(albums)
      .set({ title, imgUrl: imgUrl || null })
      .where(eq(albums.id, albumId));

    // อัปเดตศิลปินของอัลบั้ม
    await db.delete(albumArtists).where(eq((albumArtists as any).albumId || (albumArtists as any).album_id, albumId));
    if (artistIds && Array.isArray(artistIds) && artistIds.length > 0) {
      await db.insert(albumArtists).values(
        artistIds.map((id: string) => ({ albumId, artistId: id }))
      );
    }

    await insertAuditLog(db, 'admin', 'update', `Updated album: ${title} (${albumId})`, undefined, adminId);

    return c.json({ success: true, message: 'อัปเดตข้อมูลอัลบั้มเรียบร้อย' });
  } catch (error) {
    console.error("🔥 Update Album Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- 46. API Admin: ลบอัลบั้ม (Delete Album) ---
app.delete('/api/admin/albums/:id', async (c) => {
  try {
    const albumId = c.req.param('id');
    const { adminId } = await c.req.json();

    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);

    const target = await db.select().from(albums).where(eq(albums.id, albumId));
    if (target.length === 0) return c.json({ error: 'ไม่พบอัลบั้ม' }, 404);

    await db.delete(albums).where(eq(albums.id, albumId));
    await insertAuditLog(db, 'admin', 'delete', `Deleted album: ${target[0].title} (${albumId})`, undefined, adminId);

    return c.json({ success: true, message: 'ลบอัลบั้มเรียบร้อย' });
  } catch (error) {
    console.error("🔥 Delete Album Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;