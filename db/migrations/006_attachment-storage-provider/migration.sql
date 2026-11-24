-- Track which object storage provider owns each uploaded file.
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'railway';

UPDATE attachments
   SET storage_provider = 'railway'
 WHERE storage_provider IS NULL OR storage_provider = '';

CREATE INDEX IF NOT EXISTS attachments_storage_provider_idx
  ON attachments (storage_provider);
