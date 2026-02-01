CREATE TABLE "homework" (
	"date" text PRIMARY KEY NOT NULL,
	"tasks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
