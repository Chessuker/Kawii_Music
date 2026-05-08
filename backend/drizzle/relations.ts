import { relations } from "drizzle-orm/relations";
import { users, logs, admins, userSubscriptions, subscriptions, playlists, histories, tracks, purchaseTransactions, albums, albumArtists, artists, trackArtists, trackAlbums, trackGenres, genres, artistFollows, items, artistItems, playlistTracks, likeSongs, transactionItems } from "./schema";

export const logsRelations = relations(logs, ({one}) => ({
	user: one(users, {
		fields: [logs.userId],
		references: [users.id]
	}),
	admin: one(admins, {
		fields: [logs.adminId],
		references: [admins.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	logs: many(logs),
	userSubscriptions: many(userSubscriptions),
	playlists: many(playlists),
	histories: many(histories),
	purchaseTransactions: many(purchaseTransactions),
	artistFollows: many(artistFollows),
	likeSongs: many(likeSongs),
}));

export const adminsRelations = relations(admins, ({many}) => ({
	logs: many(logs),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({one}) => ({
	user: one(users, {
		fields: [userSubscriptions.userId],
		references: [users.id]
	}),
	subscription: one(subscriptions, {
		fields: [userSubscriptions.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({many}) => ({
	userSubscriptions: many(userSubscriptions),
}));

export const playlistsRelations = relations(playlists, ({one, many}) => ({
	user: one(users, {
		fields: [playlists.userId],
		references: [users.id]
	}),
	playlistTracks: many(playlistTracks),
}));

export const historiesRelations = relations(histories, ({one}) => ({
	user: one(users, {
		fields: [histories.userId],
		references: [users.id]
	}),
	track: one(tracks, {
		fields: [histories.trackId],
		references: [tracks.id]
	}),
}));

export const tracksRelations = relations(tracks, ({many}) => ({
	histories: many(histories),
	trackArtists: many(trackArtists),
	trackAlbums: many(trackAlbums),
	trackGenres: many(trackGenres),
	playlistTracks: many(playlistTracks),
	likeSongs: many(likeSongs),
}));

export const purchaseTransactionsRelations = relations(purchaseTransactions, ({one, many}) => ({
	user: one(users, {
		fields: [purchaseTransactions.userId],
		references: [users.id]
	}),
	transactionItems: many(transactionItems),
}));

export const albumArtistsRelations = relations(albumArtists, ({one}) => ({
	album: one(albums, {
		fields: [albumArtists.albumId],
		references: [albums.id]
	}),
	artist: one(artists, {
		fields: [albumArtists.artistId],
		references: [artists.id]
	}),
}));

export const albumsRelations = relations(albums, ({many}) => ({
	albumArtists: many(albumArtists),
	trackAlbums: many(trackAlbums),
}));

export const artistsRelations = relations(artists, ({many}) => ({
	albumArtists: many(albumArtists),
	trackArtists: many(trackArtists),
	artistFollows: many(artistFollows),
	artistItems: many(artistItems),
}));

export const trackArtistsRelations = relations(trackArtists, ({one}) => ({
	track: one(tracks, {
		fields: [trackArtists.trackId],
		references: [tracks.id]
	}),
	artist: one(artists, {
		fields: [trackArtists.artistId],
		references: [artists.id]
	}),
}));

export const trackAlbumsRelations = relations(trackAlbums, ({one}) => ({
	track: one(tracks, {
		fields: [trackAlbums.trackId],
		references: [tracks.id]
	}),
	album: one(albums, {
		fields: [trackAlbums.albumId],
		references: [albums.id]
	}),
}));

export const trackGenresRelations = relations(trackGenres, ({one}) => ({
	track: one(tracks, {
		fields: [trackGenres.trackId],
		references: [tracks.id]
	}),
	genre: one(genres, {
		fields: [trackGenres.genreId],
		references: [genres.id]
	}),
}));

export const genresRelations = relations(genres, ({many}) => ({
	trackGenres: many(trackGenres),
}));

export const artistFollowsRelations = relations(artistFollows, ({one}) => ({
	user: one(users, {
		fields: [artistFollows.userId],
		references: [users.id]
	}),
	artist: one(artists, {
		fields: [artistFollows.artistId],
		references: [artists.id]
	}),
}));

export const artistItemsRelations = relations(artistItems, ({one}) => ({
	item: one(items, {
		fields: [artistItems.itemId],
		references: [items.id]
	}),
	artist: one(artists, {
		fields: [artistItems.artistId],
		references: [artists.id]
	}),
}));

export const itemsRelations = relations(items, ({many}) => ({
	artistItems: many(artistItems),
	transactionItems: many(transactionItems),
}));

export const playlistTracksRelations = relations(playlistTracks, ({one}) => ({
	playlist: one(playlists, {
		fields: [playlistTracks.playlistId],
		references: [playlists.id]
	}),
	track: one(tracks, {
		fields: [playlistTracks.trackId],
		references: [tracks.id]
	}),
}));

export const likeSongsRelations = relations(likeSongs, ({one}) => ({
	user: one(users, {
		fields: [likeSongs.userId],
		references: [users.id]
	}),
	track: one(tracks, {
		fields: [likeSongs.trackId],
		references: [tracks.id]
	}),
}));

export const transactionItemsRelations = relations(transactionItems, ({one}) => ({
	item: one(items, {
		fields: [transactionItems.itemId],
		references: [items.id]
	}),
	purchaseTransaction: one(purchaseTransactions, {
		fields: [transactionItems.tranId],
		references: [purchaseTransactions.id]
	}),
}));