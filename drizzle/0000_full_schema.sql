CREATE TYPE "public"."application_status" AS ENUM('new', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('held', 'confirmed', 'completed', 'no_show', 'cancelled', 'refunded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."bundle_status" AS ENUM('active', 'exhausted', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."exception_kind" AS ENUM('block', 'extra');--> statement-breakpoint
CREATE TYPE "public"."expert_status" AS ENUM('draft', 'live', 'paused');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pending', 'active', 'expired', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership_tier" AS ENUM('quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('booking_confirmed_customer', 'booking_confirmed_expert', 'intake_nudge', 'reminder_24h', 'reminder_1h', 'followup', 'refund_apology');--> statement-breakpoint
CREATE TYPE "public"."ops_user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('single', 'bundle_call', 'monthly', 'membership_call');--> statement-breakpoint
CREATE TYPE "public"."sebi_reg_type" AS ENUM('ria', 'ra', 'none');--> statement-breakpoint
CREATE TYPE "public"."specialty" AS ENUM('portfolio_audit', 'fno_systematic');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "exception_kind" NOT NULL,
	"start_minute" integer,
	"end_minute" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'held' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"product" "product_type" DEFAULT 'single' NOT NULL,
	"bundle_id" uuid,
	"membership_id" uuid,
	"amount_paise" integer NOT NULL,
	"meeting_url" text,
	"cancelled_reason" text,
	"expert_note" text,
	"expert_note_at" timestamp with time zone,
	"reschedule_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"expert_id" uuid,
	"credits_total" smallint DEFAULT 3 NOT NULL,
	"credits_used" smallint DEFAULT 0 NOT NULL,
	"amount_paise" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "bundle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"disclaimer_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"last_link_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"headline" text NOT NULL,
	"bio" text NOT NULL,
	"background" text DEFAULT '' NOT NULL,
	"specialties" "specialty"[] NOT NULL,
	"years_experience" smallint NOT NULL,
	"sebi_reg_type" "sebi_reg_type" DEFAULT 'none' NOT NULL,
	"sebi_reg_number" text,
	"links" text,
	"note" text,
	"ip_hash" text,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"expert_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"reference" text,
	"note" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"initials" text NOT NULL,
	"headline" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"background" text DEFAULT '' NOT NULL,
	"specialties" "specialty"[] NOT NULL,
	"years_experience" smallint NOT NULL,
	"price_paise" integer NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"sebi_reg_type" "sebi_reg_type" DEFAULT 'none' NOT NULL,
	"sebi_reg_number" text,
	"meeting_url" text,
	"contact_email" text NOT NULL,
	"status" "expert_status" DEFAULT 'draft' NOT NULL,
	"last_link_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"google_email" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_accounts_expert_id_unique" UNIQUE("expert_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"tier" "membership_tier" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ops_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"note" text,
	"ip" text,
	"user_agent" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ops_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "ops_user_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"bundle_id" uuid,
	"membership_id" uuid,
	"razorpay_order_id" text NOT NULL,
	"razorpay_payment_id" text,
	"amount_paise" integer NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"payer_method" text,
	"payer_instrument" text,
	"payer_contact" text,
	"payer_email" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sign_in_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundles" ADD CONSTRAINT "bundles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundles" ADD CONSTRAINT "bundles_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consents" ADD CONSTRAINT "consents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_applications" ADD CONSTRAINT "expert_applications_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_payouts" ADD CONSTRAINT "expert_payouts_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_payouts" ADD CONSTRAINT "expert_payouts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_sessions" ADD CONSTRAINT "expert_sessions_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ops_events" ADD CONSTRAINT "ops_events_actor_id_ops_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."ops_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sign_in_codes" ADD CONSTRAINT "sign_in_codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "availability_exceptions_expert_idx" ON "availability_exceptions" USING btree ("expert_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "availability_rules_expert_idx" ON "availability_rules" USING btree ("expert_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_no_double_booking" ON "bookings" USING btree ("expert_id","starts_at") WHERE status in ('held','confirmed','completed');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_hold_sweep_idx" ON "bookings" USING btree ("hold_expires_at") WHERE status = 'held';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_idx" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "expert_applications_one_open_idx" ON "expert_applications" USING btree (lower("email")) WHERE status = 'new';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_applications_status_idx" ON "expert_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_applications_source_idx" ON "expert_applications" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "expert_payouts_one_per_booking" ON "expert_payouts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_payouts_expert_idx" ON "expert_payouts" USING btree ("expert_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_sessions_expert_idx" ON "expert_sessions" USING btree ("expert_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "experts_slug_idx" ON "experts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experts_status_idx" ON "experts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "intake_booking_idx" ON "intake_submissions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_sessions_customer_idx" ON "member_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_customer_idx" ON "memberships" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_window_idx" ON "memberships" USING btree ("status","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_once_idx" ON "notifications" USING btree ("booking_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_events_at_idx" ON "ops_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_events_entity_idx" ON "ops_events" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_events_actor_idx" ON "ops_events" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ops_users_email_idx" ON "ops_users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_payment_idx" ON "payments" USING btree ("razorpay_payment_id") WHERE razorpay_payment_id is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sign_in_codes_customer_idx" ON "sign_in_codes" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_event_idx" ON "webhook_events" USING btree ("provider","event_id");