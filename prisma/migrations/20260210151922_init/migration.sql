-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'SHARED');

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "family_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_records" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "url" TEXT,
    "ogp_image_url" TEXT,
    "ogp_description" TEXT,
    "memo" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "user_id" TEXT NOT NULL,
    "family_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_credentials" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(100),
    "login_id" VARCHAR(255),
    "password_hint" TEXT,
    "record_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_tags" (
    "id" TEXT NOT NULL,
    "tag_name" VARCHAR(50) NOT NULL,
    "record_id" TEXT NOT NULL,

    CONSTRAINT "record_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "service_records_user_id_idx" ON "service_records"("user_id");

-- CreateIndex
CREATE INDEX "service_records_family_id_visibility_idx" ON "service_records"("family_id", "visibility");

-- CreateIndex
CREATE INDEX "record_tags_tag_name_idx" ON "record_tags"("tag_name");

-- CreateIndex
CREATE UNIQUE INDEX "record_tags_record_id_tag_name_key" ON "record_tags"("record_id", "tag_name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_credentials" ADD CONSTRAINT "account_credentials_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "service_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_tags" ADD CONSTRAINT "record_tags_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "service_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
