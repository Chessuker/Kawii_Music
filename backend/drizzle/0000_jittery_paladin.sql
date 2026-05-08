-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."account_status_enum" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."action_type_enum" AS ENUM('create', 'update', 'delete', 'login', 'logout', 'ban', 'other');--> statement-breakpoint
CREATE TYPE "public"."actor_type_enum" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type_enum" NOT NULL,
	"action_type" "action_type_enum" NOT NULL,
	"action_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"admin_id" uuid,
	CONSTRAINT "chk_logs_actor" CHECK (((actor_type = 'user'::actor_type_enum) AND (user_id IS NOT NULL) AND (admin_id IS NULL)) OR ((actor_type = 'admin'::actor_type_enum) AND (admin_id IS NOT NULL) AND (user_id IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"pfp_url" text,
	"account_status" "account_status_enum" DEFAULT 'active' NOT NULL,
	CONSTRAINT "uq_users_email" UNIQUE("email"),
	CONSTRAINT "uq_users_username" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_admins_username" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "uq_genres_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"duration_days" integer NOT NULL,
	CONSTRAINT "uq_subscriptions_name" UNIQUE("name"),
	CONSTRAINT "subscriptions_price_check" CHECK (price >= (0)::numeric),
	CONSTRAINT "subscriptions_duration_days_check" CHECK (duration_days > 0)
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"duration" interval NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"upload_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"audio_url" text NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "tracks_view_count_check" CHECK (view_count >= 0)
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"img_url" text,
	"release_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "uq_artists_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_user_sub_start" UNIQUE("user_id","subscription_id","start_date"),
	CONSTRAINT "user_subscriptions_check" CHECK (expiry_date > start_date)
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"img_url" text,
	CONSTRAINT "items_price_check" CHECK (price >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "purchase_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_purchase" timestamp with time zone DEFAULT now() NOT NULL,
	"total_item_count" integer NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "purchase_transactions_total_item_count_check" CHECK (total_item_count > 0),
	CONSTRAINT "purchase_transactions_total_price_check" CHECK (total_price >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "album_artists" (
	"album_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "album_artists_pkey" PRIMARY KEY("album_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "track_artists" (
	"track_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "track_artists_pkey" PRIMARY KEY("track_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "track_albums" (
	"track_id" uuid NOT NULL,
	"album_id" uuid NOT NULL,
	CONSTRAINT "track_albums_pkey" PRIMARY KEY("track_id","album_id")
);
--> statement-breakpoint
CREATE TABLE "track_genres" (
	"track_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "track_genres_pkey" PRIMARY KEY("track_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "artist_follows" (
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "artist_follows_pkey" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_items" (
	"item_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "artist_items_pkey" PRIMARY KEY("item_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"playlist_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY("playlist_id","track_id"),
	CONSTRAINT "playlist_tracks_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "like_songs" (
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"liked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "like_songs_pkey" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"item_id" uuid NOT NULL,
	"tran_id" uuid NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"extended_price" numeric(12, 2) GENERATED ALWAYS AS ((unit_price * (quantity)::numeric)) STORED NOT NULL,
	CONSTRAINT "transaction_items_pkey" PRIMARY KEY("item_id","tran_id"),
	CONSTRAINT "transaction_items_unit_price_check" CHECK (unit_price >= (0)::numeric),
	CONSTRAINT "transaction_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "histories" ADD CONSTRAINT "histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "histories" ADD CONSTRAINT "histories_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_albums" ADD CONSTRAINT "track_albums_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_albums" ADD CONSTRAINT "track_albums_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_items" ADD CONSTRAINT "artist_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_items" ADD CONSTRAINT "artist_items_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like_songs" ADD CONSTRAINT "like_songs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like_songs" ADD CONSTRAINT "like_songs_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_tran_id_fkey" FOREIGN KEY ("tran_id") REFERENCES "public"."purchase_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_logs_admin_id" ON "logs" USING btree ("admin_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_logs_created_at" ON "logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_logs_user_id" ON "logs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tracks_title" ON "tracks" USING btree ("title" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subs_subscription_id" ON "user_subscriptions" USING btree ("subscription_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_subs_user_id" ON "user_subscriptions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_playlists_user_id" ON "playlists" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_histories_listened_at" ON "histories" USING btree ("listened_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_histories_track_id" ON "histories" USING btree ("track_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_histories_user_id" ON "histories" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_histories_user_listened" ON "histories" USING btree ("user_id" timestamptz_ops,"listened_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_purchase_user_id" ON "purchase_transactions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_album_artists_artist_id" ON "album_artists" USING btree ("artist_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_track_artists_artist_id" ON "track_artists" USING btree ("artist_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_track_albums_album_id" ON "track_albums" USING btree ("album_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_track_genres_genre_id" ON "track_genres" USING btree ("genre_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_artist_follows_artist" ON "artist_follows" USING btree ("artist_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_artist_items_artist_id" ON "artist_items" USING btree ("artist_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_playlist_tracks_track_id" ON "playlist_tracks" USING btree ("track_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_like_songs_track_id" ON "like_songs" USING btree ("track_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_transaction_items_tran_id" ON "transaction_items" USING btree ("tran_id" uuid_ops);
*/