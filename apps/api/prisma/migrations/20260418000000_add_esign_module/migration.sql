-- CreateEnum
CREATE TYPE "ESignDocumentStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_SIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ESignRequestStatus" AS ENUM ('PENDING', 'VIEWED', 'SIGNED', 'DECLINED', 'BOUNCED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ESignEventType" AS ENUM ('DOCUMENT_CREATED', 'INVITATION_SENT', 'LINK_OPENED', 'DOCUMENT_VIEWED', 'SIGNING_STARTED', 'DOCUMENT_SIGNED', 'DOCUMENT_DECLINED', 'ALL_SIGNED', 'DOCUMENT_COMPLETED', 'DOCUMENT_CANCELLED', 'DOCUMENT_EXPIRED', 'REMINDER_SENT', 'PDF_DOWNLOADED', 'HASH_VERIFIED', 'CERTIFICATE_ISSUED');

-- CreateEnum
CREATE TYPE "ESignReferenceType" AS ENUM ('LAUDO', 'SERVICE_ORDER', 'CONTRACT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ESignSignatureType" AS ENUM ('DRAWN', 'TYPED', 'CLICK');

-- CreateEnum
CREATE TYPE "ESignNotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM', 'WHATSAPP');

-- CreateTable
CREATE TABLE "esign_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reference_type" "ESignReferenceType" NOT NULL,
    "reference_id" TEXT,
    "status" "ESignDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "original_file_url" TEXT NOT NULL,
    "signed_file_url" TEXT,
    "original_hash" TEXT NOT NULL,
    "signed_hash" TEXT,
    "require_signing_order" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esign_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esign_requests" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "signer_user_id" TEXT,
    "signer_name" TEXT NOT NULL,
    "signer_email" TEXT NOT NULL,
    "signer_phone" TEXT,
    "signer_cpf" TEXT,
    "signer_role" TEXT NOT NULL,
    "signing_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ESignRequestStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "notification_channels" "ESignNotificationChannel"[],
    "custom_message" TEXT,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "signature_data" TEXT,
    "signature_type" "ESignSignatureType",
    "viewed_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esign_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esign_events" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "request_id" TEXT,
    "event_type" "ESignEventType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT,
    "actor_email" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "geolocation" JSONB,
    "device_fingerprint" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esign_certificates" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "certificate_hash" TEXT NOT NULL,
    "verification_url" TEXT NOT NULL,
    "qr_code_image_url" TEXT,
    "signatures_snapshot" JSONB NOT NULL,
    "document_snapshot" JSONB NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esign_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "esign_documents_company_id_idx" ON "esign_documents"("company_id");

-- CreateIndex
CREATE INDEX "esign_documents_reference_id_reference_type_idx" ON "esign_documents"("reference_id", "reference_type");

-- CreateIndex
CREATE UNIQUE INDEX "esign_requests_token_key" ON "esign_requests"("token");

-- CreateIndex
CREATE INDEX "esign_requests_document_id_idx" ON "esign_requests"("document_id");

-- CreateIndex
CREATE INDEX "esign_requests_token_idx" ON "esign_requests"("token");

-- CreateIndex
CREATE INDEX "esign_requests_signer_email_idx" ON "esign_requests"("signer_email");

-- CreateIndex
CREATE INDEX "esign_events_document_id_idx" ON "esign_events"("document_id");

-- CreateIndex
CREATE INDEX "esign_events_request_id_idx" ON "esign_events"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "esign_certificates_document_id_key" ON "esign_certificates"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "esign_certificates_certificate_hash_key" ON "esign_certificates"("certificate_hash");

-- CreateIndex
CREATE INDEX "esign_certificates_certificate_hash_idx" ON "esign_certificates"("certificate_hash");

-- AddForeignKey
ALTER TABLE "esign_documents" ADD CONSTRAINT "esign_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_documents" ADD CONSTRAINT "esign_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_requests" ADD CONSTRAINT "esign_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "esign_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_requests" ADD CONSTRAINT "esign_requests_signer_user_id_fkey" FOREIGN KEY ("signer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_events" ADD CONSTRAINT "esign_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "esign_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_events" ADD CONSTRAINT "esign_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "esign_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esign_certificates" ADD CONSTRAINT "esign_certificates_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "esign_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
