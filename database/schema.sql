CREATE TABLE IF NOT EXISTS __ef_migrations_history (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TYPE assignment_status AS ENUM ('draft', 'published', 'archived');
    CREATE TYPE submission_status AS ENUM ('submitted', 'under_review', 'graded', 'returned_for_revision');
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE application_settings (
        id uuid NOT NULL,
        key character varying(150) NOT NULL,
        value character varying(2000) NOT NULL,
        data_type character varying(20) NOT NULL,
        description character varying(500),
        is_public boolean NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_application_settings PRIMARY KEY (id),
        CONSTRAINT ck_application_settings_data_type CHECK (data_type IN ('boolean', 'integer', 'decimal', 'string'))
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE audit_logs (
        id uuid NOT NULL,
        user_id uuid,
        action character varying(50) NOT NULL,
        entity_name character varying(100) NOT NULL,
        entity_id uuid,
        old_values jsonb,
        new_values jsonb,
        ip_address character varying(64),
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_audit_logs PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE classes (
        id uuid NOT NULL,
        name character varying(150) NOT NULL,
        code character varying(50) NOT NULL,
        description character varying(1000),
        academic_year character varying(20),
        is_active boolean NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_classes PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE subjects (
        id uuid NOT NULL,
        name character varying(150) NOT NULL,
        code character varying(50) NOT NULL,
        description character varying(1000),
        is_active boolean NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_subjects PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE users (
        id uuid NOT NULL,
        full_name character varying(150) NOT NULL,
        email character varying(256) NOT NULL,
        password_hash character varying(256) NOT NULL,
        role user_role NOT NULL,
        is_active boolean NOT NULL,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_users PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE class_subjects (
        id uuid NOT NULL,
        class_id uuid NOT NULL,
        subject_id uuid NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_class_subjects PRIMARY KEY (id),
        CONSTRAINT fk_class_subjects_classes_class_id FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT,
        CONSTRAINT fk_class_subjects_subjects_subject_id FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE enrollments (
        id uuid NOT NULL,
        student_id uuid NOT NULL,
        class_id uuid NOT NULL,
        enrolled_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_enrollments PRIMARY KEY (id),
        CONSTRAINT fk_enrollments_classes_class_id FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT,
        CONSTRAINT fk_enrollments_users_student_id FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE refresh_tokens (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        token_hash character varying(128) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        replaced_by_token_hash character varying(128),
        created_by_ip character varying(64),
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
        CONSTRAINT fk_refresh_tokens_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE assignments (
        id uuid NOT NULL,
        title character varying(200) NOT NULL,
        description character varying(10000) NOT NULL,
        class_subject_id uuid NOT NULL,
        created_by_teacher_id uuid NOT NULL,
        deadline timestamptz NOT NULL,
        max_marks numeric(6,2) NOT NULL,
        status assignment_status NOT NULL,
        published_at timestamptz,
        allow_resubmission boolean NOT NULL,
        allow_late_submission boolean NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_assignments PRIMARY KEY (id),
        CONSTRAINT ck_assignments_max_marks_positive CHECK (max_marks > 0),
        CONSTRAINT ck_assignments_published_has_timestamp CHECK (status <> 'published' OR published_at IS NOT NULL),
        CONSTRAINT fk_assignments_class_subjects_class_subject_id FOREIGN KEY (class_subject_id) REFERENCES class_subjects (id) ON DELETE RESTRICT,
        CONSTRAINT fk_assignments_users_created_by_teacher_id FOREIGN KEY (created_by_teacher_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE teacher_assignments (
        id uuid NOT NULL,
        teacher_id uuid NOT NULL,
        class_subject_id uuid NOT NULL,
        assigned_at timestamptz NOT NULL,
        assigned_by_user_id uuid,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_teacher_assignments PRIMARY KEY (id),
        CONSTRAINT fk_teacher_assignments_class_subjects_class_subject_id FOREIGN KEY (class_subject_id) REFERENCES class_subjects (id) ON DELETE RESTRICT,
        CONSTRAINT fk_teacher_assignments_users_teacher_id FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE submissions (
        id uuid NOT NULL,
        assignment_id uuid NOT NULL,
        student_id uuid NOT NULL,
        content character varying(50000) NOT NULL,
        attachment_url character varying(2048),
        submitted_at timestamptz NOT NULL,
        last_updated_at timestamptz,
        is_late boolean NOT NULL,
        status submission_status NOT NULL,
        marks numeric(6,2),
        graded_by_teacher_id uuid,
        graded_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_submissions PRIMARY KEY (id),
        CONSTRAINT ck_submissions_graded_has_grader CHECK (status <> 'graded' OR (marks IS NOT NULL AND graded_by_teacher_id IS NOT NULL AND graded_at IS NOT NULL)),
        CONSTRAINT ck_submissions_marks_non_negative CHECK (marks IS NULL OR marks >= 0),
        CONSTRAINT fk_submissions_assignments_assignment_id FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE RESTRICT,
        CONSTRAINT fk_submissions_users_graded_by_teacher_id FOREIGN KEY (graded_by_teacher_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT fk_submissions_users_student_id FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE TABLE submission_feedbacks (
        id uuid NOT NULL,
        submission_id uuid NOT NULL,
        teacher_id uuid NOT NULL,
        comment character varying(5000) NOT NULL,
        marks_at_time numeric(6,2),
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_submission_feedbacks PRIMARY KEY (id),
        CONSTRAINT fk_submission_feedbacks_submissions_submission_id FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
        CONSTRAINT fk_submission_feedbacks_users_teacher_id FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_application_settings_key_unique ON application_settings (key) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_assignments_class_subject_status ON assignments (class_subject_id, status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_assignments_created_by_teacher ON assignments (created_by_teacher_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_assignments_deadline ON assignments (deadline);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at DESC);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_audit_logs_entity ON audit_logs (entity_name, entity_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_class_subjects_class_subject_unique ON class_subjects (class_id, subject_id) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_class_subjects_subject_id ON class_subjects (subject_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_classes_code_unique ON classes (code) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_enrollments_class ON enrollments (class_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_enrollments_student_class_unique ON enrollments (student_id, class_id) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_refresh_tokens_hash ON refresh_tokens (token_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_refresh_tokens_user_expiry ON refresh_tokens (user_id, expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_subjects_code_unique ON subjects (code) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_submission_feedbacks_submission_created ON submission_feedbacks (submission_id, created_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_submission_feedbacks_teacher_id ON submission_feedbacks (teacher_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_submissions_assignment_status ON submissions (assignment_id, status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_submissions_assignment_student_unique ON submissions (assignment_id, student_id) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_submissions_graded_by_teacher_id ON submissions (graded_by_teacher_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_submissions_student ON submissions (student_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_teacher_assignments_class_subject ON teacher_assignments (class_subject_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_teacher_assignments_teacher_class_subject_unique ON teacher_assignments (teacher_id, class_subject_id) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE UNIQUE INDEX ix_users_email_unique ON users (email) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    CREATE INDEX ix_users_role ON users (role);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260802190358_InitialSchema') THEN
    INSERT INTO __ef_migrations_history (migration_id, product_version)
    VALUES ('20260802190358_InitialSchema', '9.0.0');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    CREATE TYPE submission_event_type AS ENUM ('document_open', 'insert', 'delete', 'paste', 'cut', 'format', 'block_change', 'node_insert', 'node_delete', 'block_move', 'undo', 'redo', 'selection_change', 'idle', 'focus_lost', 'focus_regained', 'auto_save', 'manual_save', 'submit', 'document_close');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    ALTER TABLE submissions ADD content_json text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    CREATE TABLE submission_events (
        id uuid NOT NULL,
        submission_id uuid NOT NULL,
        sequence bigint NOT NULL,
        type submission_event_type NOT NULL,
        offset_ms bigint NOT NULL,
        received_at timestamptz NOT NULL,
        session_id uuid NOT NULL,
        cursor_from integer,
        cursor_to integer,
        block_id character varying(64),
        payload jsonb,
        characters_added integer NOT NULL,
        characters_removed integer NOT NULL,
        pasted_words integer NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_submission_events PRIMARY KEY (id),
        CONSTRAINT ck_submission_events_offset_non_negative CHECK (offset_ms >= 0),
        CONSTRAINT fk_submission_events_submissions_submission_id FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    CREATE TABLE submission_versions (
        id uuid NOT NULL,
        submission_id uuid NOT NULL,
        version_number integer NOT NULL,
        content_json jsonb NOT NULL,
        plain_text text NOT NULL,
        word_count integer NOT NULL,
        at_sequence bigint NOT NULL,
        reason character varying(32) NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_submission_versions PRIMARY KEY (id),
        CONSTRAINT ck_submission_versions_number_positive CHECK (version_number > 0),
        CONSTRAINT fk_submission_versions_submissions_submission_id FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    CREATE UNIQUE INDEX ix_submission_events_submission_sequence ON submission_events (submission_id, sequence);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    CREATE INDEX ix_submission_events_submission_type ON submission_events (submission_id, type);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    CREATE UNIQUE INDEX ix_submission_versions_submission_number_unique ON submission_versions (submission_id, version_number) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260803184008_RichEditorAndReplay') THEN
    INSERT INTO __ef_migrations_history (migration_id, product_version)
    VALUES ('20260803184008_RichEditorAndReplay', '9.0.0');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804113247_Notifications') THEN
    CREATE TABLE notifications (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        type integer NOT NULL,
        title character varying(200) NOT NULL,
        body character varying(500) NOT NULL,
        link_url character varying(300),
        is_read boolean NOT NULL,
        read_at timestamptz,
        subject_id uuid,
        dedupe_key character varying(120),
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_notifications PRIMARY KEY (id),
        CONSTRAINT fk_notifications_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804113247_Notifications') THEN
    CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804113247_Notifications') THEN
    CREATE UNIQUE INDEX ix_notifications_user_dedupe_unique ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804113247_Notifications') THEN
    CREATE INDEX ix_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = false AND is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804113247_Notifications') THEN
    INSERT INTO __ef_migrations_history (migration_id, product_version)
    VALUES ('20260804113247_Notifications', '9.0.0');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804143036_EnableRowLevelSecurity') THEN
    DO $harden$
    DECLARE
        target text;
        grantee text;
    BEGIN
        FOR target IN
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
              AND NOT c.relrowsecurity
        LOOP
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
        END LOOP;

        -- Belt and braces. RLS alone already denies these roles every row;
        -- removing the grants as well means a policy added by accident
        -- later cannot re-open the schema on its own.
        FOREACH grantee IN ARRAY ARRAY['anon', 'authenticated']
        LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = grantee) THEN
                EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', grantee);
                EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', grantee);
                EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', grantee);
                EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', grantee);

                -- Without this, the next table this role creates would be
                -- granted to them again by default.
                EXECUTE format(
                    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
                    grantee);
                EXECUTE format(
                    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
                    grantee);
            END IF;
        END LOOP;
    END
    $harden$;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804143036_EnableRowLevelSecurity') THEN
    INSERT INTO __ef_migrations_history (migration_id, product_version)
    VALUES ('20260804143036_EnableRowLevelSecurity', '9.0.0');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    ALTER TABLE assignments ADD description_json text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    ALTER TABLE assignments ADD grading_type integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE TABLE assignment_attachments (
        id uuid NOT NULL,
        assignment_id uuid NOT NULL,
        file_name character varying(260) NOT NULL,
        content_type character varying(100) NOT NULL,
        size_bytes bigint NOT NULL,
        content bytea NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_assignment_attachments PRIMARY KEY (id),
        CONSTRAINT ck_assignment_attachments_size_positive CHECK (size_bytes > 0),
        CONSTRAINT fk_assignment_attachments_assignments_assignment_id FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE TABLE rubric_criteria (
        id uuid NOT NULL,
        assignment_id uuid NOT NULL,
        "order" integer NOT NULL,
        title character varying(200) NOT NULL,
        description character varying(1000),
        max_points numeric(6,2) NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_rubric_criteria PRIMARY KEY (id),
        CONSTRAINT ck_rubric_criteria_points_positive CHECK (max_points > 0),
        CONSTRAINT fk_rubric_criteria_assignments_assignment_id FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE TABLE submission_criterion_scores (
        id uuid NOT NULL,
        submission_id uuid NOT NULL,
        rubric_criterion_id uuid NOT NULL,
        points numeric(6,2) NOT NULL,
        comment character varying(1000),
        created_at timestamptz NOT NULL,
        updated_at timestamptz,
        created_by uuid,
        modified_by uuid,
        is_deleted boolean NOT NULL,
        deleted_at timestamptz,
        deleted_by uuid,
        CONSTRAINT pk_submission_criterion_scores PRIMARY KEY (id),
        CONSTRAINT ck_criterion_scores_points_non_negative CHECK (points >= 0),
        CONSTRAINT fk_submission_criterion_scores_rubric_criteria_rubric_criterio FOREIGN KEY (rubric_criterion_id) REFERENCES rubric_criteria (id) ON DELETE RESTRICT,
        CONSTRAINT fk_submission_criterion_scores_submissions_submission_id FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE INDEX ix_assignment_attachments_assignment ON assignment_attachments (assignment_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE INDEX ix_rubric_criteria_assignment_order ON rubric_criteria (assignment_id, "order");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE UNIQUE INDEX ix_criterion_scores_submission_criterion_unique ON submission_criterion_scores (submission_id, rubric_criterion_id) WHERE is_deleted = false;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    CREATE INDEX ix_submission_criterion_scores_rubric_criterion_id ON submission_criterion_scores (rubric_criterion_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260804181103_AssignmentAuthoringAndGrading') THEN
    INSERT INTO __ef_migrations_history (migration_id, product_version)
    VALUES ('20260804181103_AssignmentAuthoringAndGrading', '9.0.0');
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260806204438_RemoveAssignmentAttachments') THEN
    DROP TABLE assignment_attachments;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM __ef_migrations_history WHERE "migration_id" = '20260806204438_RemoveAssignmentAttachments') THEN
    INSERT INTO __ef_migrations_history (migration_id, product_version)
    VALUES ('20260806204438_RemoveAssignmentAttachments', '9.0.0');
    END IF;
END $EF$;
COMMIT;

