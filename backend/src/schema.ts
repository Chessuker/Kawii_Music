import { pgTable, index, foreignKey, check, uuid, text, timestamp, unique, numeric, integer, interval, boolean, bigint, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accountStatusEnum = pgEnum("account_status_enum", ['active', 'suspended', 'deleted'])
export const actionTypeEnum = pgEnum("action_type_enum", ['create', 'update', 'delete', 'login', 'logout', 'ban', 'other'])
export const actorTypeEnum = pgEnum("actor_type_enum", ['user', 'admin'])


export const logs = pgTable("logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorType: actorTypeEnum("actor_type").notNull(),
	actionType: actionTypeEnum("action_type").notNull(),
	actionDetail: text("action_detail"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id"),
	adminId: uuid("admin_id"),
}, (table) => [
	index("idx_logs_admin_id").using("btree", table.adminId.asc().nullsLast().op("uuid_ops")),
	index("idx_logs_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_logs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "logs_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "logs_admin_id_fkey"
		}).onDelete("set null"),
	check("chk_logs_actor", sql`((actor_type = 'user'::actor_type_enum) AND (user_id IS NOT NULL) AND (admin_id IS NULL)) OR ((actor_type = 'admin'::actor_type_enum) AND (admin_id IS NOT NULL) AND (user_id IS NULL))`),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	displayName: text("display_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	pfpUrl: text("pfp_url"),
	accountStatus: accountStatusEnum("account_status").default('active').notNull(),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("uq_users_email").on(table.email),
	unique("uq_users_username").on(table.username),
]);

export const admins = pgTable("admins", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("uq_admins_username").on(table.username),
]);

export const genres = pgTable("genres", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
}, (table) => [
	unique("uq_genres_name").on(table.name),
]);

export const subscriptions = pgTable("subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	durationDays: integer("duration_days").notNull(),
}, (table) => [
	unique("uq_subscriptions_name").on(table.name),
	check("subscriptions_price_check", sql`price >= (0)::numeric`),
	check("subscriptions_duration_days_check", sql`duration_days > 0`),
]);

export const tracks = pgTable("tracks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	duration: interval().notNull(),
	isFree: boolean("is_free").default(false).notNull(),
	uploadDate: timestamp("upload_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	audioUrl: text("audio_url").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	viewCount: bigint("view_count", { mode: "number" }).default(0).notNull(),
}, (table) => [
	index("idx_tracks_title").using("btree", table.title.asc().nullsLast().op("text_ops")),
	check("tracks_view_count_check", sql`view_count >= 0`),
]);

export const albums = pgTable("albums", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	imgUrl: text("img_url"),
	releaseDate: timestamp("release_date", { withTimezone: true, mode: 'string' }),
});

export const artists = pgTable("artists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
}, (table) => [
	unique("uq_artists_name").on(table.name),
]);

export const userSubscriptions = pgTable("user_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiryDate: timestamp("expiry_date", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_user_subs_subscription_id").using("btree", table.subscriptionId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_subs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_subscriptions_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "user_subscriptions_subscription_id_fkey"
		}).onDelete("restrict"),
	unique("uq_user_sub_start").on(table.userId, table.subscriptionId, table.startDate),
	check("user_subscriptions_check", sql`expiry_date > start_date`),
]);

export const playlists = pgTable("playlists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	userId: uuid("user_id").notNull(),
}, (table) => [
	index("idx_playlists_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "playlists_user_id_fkey"
		}).onDelete("cascade"),
]);

export const histories = pgTable("histories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	listenedAt: timestamp("listened_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id").notNull(),
	trackId: uuid("track_id").notNull(),
}, (table) => [
	index("idx_histories_listened_at").using("btree", table.listenedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_histories_track_id").using("btree", table.trackId.asc().nullsLast().op("uuid_ops")),
	index("idx_histories_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_histories_user_listened").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.listenedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "histories_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.trackId],
			foreignColumns: [tracks.id],
			name: "histories_track_id_fkey"
		}).onDelete("cascade"),
]);

export const items = pgTable("items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	imgUrl: text("img_url"),
}, (table) => [
	check("items_price_check", sql`price >= (0)::numeric`),
]);

export const purchaseTransactions = pgTable("purchase_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	timePurchase: timestamp("time_purchase", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	totalItemCount: integer("total_item_count").notNull(),
	totalPrice: numeric("total_price", { precision: 12, scale:  2 }).notNull(),
	userId: uuid("user_id").notNull(),
}, (table) => [
	index("idx_purchase_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "purchase_transactions_user_id_fkey"
		}).onDelete("restrict"),
	check("purchase_transactions_total_item_count_check", sql`total_item_count > 0`),
	check("purchase_transactions_total_price_check", sql`total_price >= (0)::numeric`),
]);

export const albumArtists = pgTable("album_artists", {
	albumId: uuid("album_id").notNull(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	index("idx_album_artists_artist_id").using("btree", table.artistId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.albumId],
			foreignColumns: [albums.id],
			name: "album_artists_album_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "album_artists_artist_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.albumId, table.artistId], name: "album_artists_pkey"}),
]);

export const trackArtists = pgTable("track_artists", {
	trackId: uuid("track_id").notNull(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	index("idx_track_artists_artist_id").using("btree", table.artistId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.trackId],
			foreignColumns: [tracks.id],
			name: "track_artists_track_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "track_artists_artist_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.trackId, table.artistId], name: "track_artists_pkey"}),
]);

export const trackAlbums = pgTable("track_albums", {
	trackId: uuid("track_id").notNull(),
	albumId: uuid("album_id").notNull(),
}, (table) => [
	index("idx_track_albums_album_id").using("btree", table.albumId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.trackId],
			foreignColumns: [tracks.id],
			name: "track_albums_track_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.albumId],
			foreignColumns: [albums.id],
			name: "track_albums_album_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.trackId, table.albumId], name: "track_albums_pkey"}),
]);

export const trackGenres = pgTable("track_genres", {
	trackId: uuid("track_id").notNull(),
	genreId: uuid("genre_id").notNull(),
}, (table) => [
	index("idx_track_genres_genre_id").using("btree", table.genreId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.trackId],
			foreignColumns: [tracks.id],
			name: "track_genres_track_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.genreId],
			foreignColumns: [genres.id],
			name: "track_genres_genre_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.trackId, table.genreId], name: "track_genres_pkey"}),
]);

export const artistFollows = pgTable("artist_follows", {
	userId: uuid("user_id").notNull(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	index("idx_artist_follows_artist").using("btree", table.artistId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "artist_follows_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "artist_follows_artist_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.artistId], name: "artist_follows_pkey"}),
]);

export const artistItems = pgTable("artist_items", {
	itemId: uuid("item_id").notNull(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	index("idx_artist_items_artist_id").using("btree", table.artistId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "artist_items_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "artist_items_artist_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.itemId, table.artistId], name: "artist_items_pkey"}),
]);

export const playlistTracks = pgTable("playlist_tracks", {
	playlistId: uuid("playlist_id").notNull(),
	trackId: uuid("track_id").notNull(),
	position: integer().notNull(),
}, (table) => [
	index("idx_playlist_tracks_track_id").using("btree", table.trackId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.playlistId],
			foreignColumns: [playlists.id],
			name: "playlist_tracks_playlist_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.trackId],
			foreignColumns: [tracks.id],
			name: "playlist_tracks_track_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.playlistId, table.trackId], name: "playlist_tracks_pkey"}),
	check("playlist_tracks_position_check", sql`"position" >= 0`),
]);

export const likeSongs = pgTable("like_songs", {
	userId: uuid("user_id").notNull(),
	trackId: uuid("track_id").notNull(),
	likedAt: timestamp("liked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_like_songs_track_id").using("btree", table.trackId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "like_songs_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.trackId],
			foreignColumns: [tracks.id],
			name: "like_songs_track_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.trackId], name: "like_songs_pkey"}),
]);

export const transactionItems = pgTable("transaction_items", {
	itemId: uuid("item_id").notNull(),
	tranId: uuid("tran_id").notNull(),
	unitPrice: numeric("unit_price", { precision: 12, scale:  2 }).notNull(),
	quantity: integer().notNull(),
	extendedPrice: numeric("extended_price", { precision: 12, scale:  2 }).notNull().generatedAlwaysAs(sql`(unit_price * (quantity)::numeric)`),
}, (table) => [
	index("idx_transaction_items_tran_id").using("btree", table.tranId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "transaction_items_item_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.tranId],
			foreignColumns: [purchaseTransactions.id],
			name: "transaction_items_tran_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.itemId, table.tranId], name: "transaction_items_pkey"}),
	check("transaction_items_unit_price_check", sql`unit_price >= (0)::numeric`),
	check("transaction_items_quantity_check", sql`quantity > 0`),
]);
