-- サービスレコードのRLS有効化
ALTER TABLE "service_records" ENABLE ROW LEVEL SECURITY;

-- レコード作成者（所有者）は全操作可能
CREATE POLICY "owner_all_access_service_records" ON "service_records"
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- 共有設定かつ同一家族のメンバーはアクセス可能
CREATE POLICY "family_shared_access_service_records" ON "service_records"
  FOR ALL
  USING (
    visibility = 'SHARED' AND 
    family_id = current_setting('app.current_family_id', true)
  );

-- アカウント情報のRLS有効化
ALTER TABLE "account_credentials" ENABLE ROW LEVEL SECURITY;

-- 認証情報は親のサービスレコードにアクセス可能であればアクセス可能
CREATE POLICY "access_account_credentials" ON "account_credentials"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "service_records" sr
      WHERE sr.id = "account_credentials".record_id
    )
  );

-- レコードタグのRLS有効化
ALTER TABLE "record_tags" ENABLE ROW LEVEL SECURITY;

-- タグ情報は親のサービスレコードにアクセス可能であればアクセス可能
CREATE POLICY "access_record_tags" ON "record_tags"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "service_records" sr
      WHERE sr.id = "record_tags".record_id
    )
  );
