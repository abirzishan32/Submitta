--
-- Submitta - demonstration data
--
-- Sample rows for a database whose schema already exists. Apply schema.sql
-- first; this script creates no tables.
--
--     psql -d assignment_system -f database/schema.sql
--     psql -d assignment_system -f database/seed.sql
--
-- This file is OPTIONAL. The API seeds the same data itself on first start,
-- so an evaluator who simply runs the application never needs it. It is here
-- so the demonstration data can be inspected, loaded or restored without
-- running anything, and so the repository carries its sample data as data
-- rather than only as code that produces it.
--
-- Exported from the running application's own seeder, so the two cannot
-- disagree. Runtime tables - refresh_tokens, notifications, audit_logs - are
-- deliberately excluded: they are session state, not sample data.
--
-- Contents:
--     6  users .................. 1 administrator, 2 teachers, 3 students
--     2  classes ................ a school section and a college course
--     3  subjects
--     3  class_subjects ......... the offerings assignments attach to
--     3  teacher_assignments .... which teacher may touch which offering
--     3  enrollments
--     4  assignments ............ draft, open, due soon, past deadline
--     3  submissions ............ one already graded 85/100
--     1  submission_feedbacks
--     8  application_settings
--
-- Every demonstration account uses the password: Demo@1234
-- The stored values are BCrypt hashes of that published demo password.
--
-- Re-running this script will fail on the primary keys, by design: it is a
-- load for an empty schema, not a merge. To start over, drop and recreate the
-- database, or use `docker compose down --volumes`.
--

BEGIN;

--
-- PostgreSQL database dump
--
\restrict aJhkaOSve7JEPGkNeHzmzdbaMYPyBfl6s8E5YfGa1o9npK5hLysOdJBAMzt7DFT
-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10
--
-- Data for Name: application_settings; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('505dbd5f-a236-3764-21a8-8158b3c77a2e', 'submission.allow_update_before_deadline', 'true', 'boolean', 'Default value of ''allow resubmission'' on a new assignment.', false, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('6519ed43-cead-f302-ec1b-33e872f45a70', 'submission.allow_late_by_default', 'false', 'boolean', 'Default value of ''allow late submission'' on a new assignment.', false, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('92f2ffc2-5b30-4f89-0f19-9e8a64d00941', 'auth.allow_self_registration', 'true', 'boolean', 'Whether students and teachers can create their own accounts.', true, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('9cd6fa6c-2a37-afbd-fd7b-f5c8c98536e9', 'grading.default_max_marks', '100', 'integer', 'Maximum marks prefilled when a teacher creates an assignment.', false, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('ac2f8dce-e03c-0d4a-54e7-4ae95b95bb23', 'app.academic_year', '2025-2026', 'string', 'Current academic year.', true, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('dc0fae3e-c62b-d98d-bda6-d593885783a3', 'auth.allow_teacher_registration', 'true', 'boolean', 'Whether the sign-up form offers the teacher role.', true, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('eadaa955-390b-211c-a599-5a8c7f7cd563', 'auth.teacher_requires_approval', 'true', 'boolean', 'New teacher accounts start deactivated until an admin approves them.', true, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.application_settings (id, key, value, data_type, description, is_public, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('ec515a41-f38f-5dce-68c5-a68ecabe60fc', 'app.institution_name', 'Greenwood Institute', 'string', 'Name shown in the application header.', true, '2026-08-07 09:54:11.150742+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.classes (id, name, code, description, academic_year, is_active, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('188c7e35-1a9a-271e-9589-cf3b2e837993', 'CSE 3101 - Database Systems', 'CSE-3101', 'Third-year undergraduate database systems course.', '2025-2026', true, '2026-08-07 09:54:10.870037+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.classes (id, name, code, description, academic_year, is_active, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('57373f3a-bacb-3856-e22a-8b8c0034b7d4', 'Grade 10 - Section A', 'G10-A', 'Secondary school, tenth grade, section A.', '2025-2026', true, '2026-08-07 09:54:10.870037+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.subjects (id, name, code, description, is_active, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('3c487c55-06ee-dbcb-a8ac-5270e62659be', 'Physics', 'PHY', 'Mechanics, thermodynamics and waves.', true, '2026-08-07 09:54:10.8931+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.subjects (id, name, code, description, is_active, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('928391a9-cdb9-eb41-f0d4-3a5accb1930b', 'Database Management Systems', 'DBMS', 'Relational modelling, normalization and SQL.', true, '2026-08-07 09:54:10.8931+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.subjects (id, name, code, description, is_active, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('98602184-49cc-ae66-8d51-cc1b7257f7b5', 'Mathematics', 'MATH', 'Algebra, geometry and trigonometry.', true, '2026-08-07 09:54:10.8931+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: class_subjects; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.class_subjects (id, class_id, subject_id, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('66ce2c9b-f69d-6712-20d8-1f97cf973b90', '57373f3a-bacb-3856-e22a-8b8c0034b7d4', '98602184-49cc-ae66-8d51-cc1b7257f7b5', '2026-08-07 09:54:10.927201+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.class_subjects (id, class_id, subject_id, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('b1779c05-10d5-05a5-d76d-0c373c805c6a', '188c7e35-1a9a-271e-9589-cf3b2e837993', '928391a9-cdb9-eb41-f0d4-3a5accb1930b', '2026-08-07 09:54:10.927201+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.class_subjects (id, class_id, subject_id, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('ecfa6ff0-ac96-5f50-04b9-6b165a50aace', '57373f3a-bacb-3856-e22a-8b8c0034b7d4', '3c487c55-06ee-dbcb-a8ac-5270e62659be', '2026-08-07 09:54:10.927201+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active, last_login_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('506d4915-e7f3-53bd-7dcd-edc53c1fb224', 'Rafiq Hasan', 'rafiq.hasan@school.edu', '$2a$12$x3ZVXONk9zPtwY3VNXzcp.ma8uNAPVtbXTg6EGPnf8l6KelVji5eq', 'teacher', true, NULL, '2026-08-07 09:54:10.794896+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active, last_login_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('8dc10129-cf00-d645-5211-4e19a86bdd90', 'Mim Chowdhury', 'mim.chowdhury@school.edu', '$2a$12$x3ZVXONk9zPtwY3VNXzcp.ma8uNAPVtbXTg6EGPnf8l6KelVji5eq', 'student', true, NULL, '2026-08-07 09:54:10.794896+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active, last_login_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('af138ed3-4503-7170-1560-c16b5d056f3f', 'System Administrator', 'admin@school.edu', '$2a$12$x3ZVXONk9zPtwY3VNXzcp.ma8uNAPVtbXTg6EGPnf8l6KelVji5eq', 'admin', true, NULL, '2026-08-07 09:54:10.794896+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active, last_login_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('b38fbc94-db9c-efb2-2647-f868ad9773eb', 'Nadia Islam', 'nadia.islam@school.edu', '$2a$12$x3ZVXONk9zPtwY3VNXzcp.ma8uNAPVtbXTg6EGPnf8l6KelVji5eq', 'student', true, NULL, '2026-08-07 09:54:10.794896+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active, last_login_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('b6218b0e-ec59-0bdc-08aa-0f57671ad237', 'Sarah Ahmed', 'sarah.ahmed@school.edu', '$2a$12$x3ZVXONk9zPtwY3VNXzcp.ma8uNAPVtbXTg6EGPnf8l6KelVji5eq', 'teacher', true, NULL, '2026-08-07 09:54:10.794896+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.users (id, full_name, email, password_hash, role, is_active, last_login_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('b62f607f-27c0-06bf-818b-b2243761e367', 'Tanvir Rahman', 'tanvir.rahman@school.edu', '$2a$12$x3ZVXONk9zPtwY3VNXzcp.ma8uNAPVtbXTg6EGPnf8l6KelVji5eq', 'student', true, NULL, '2026-08-07 09:54:10.794896+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: assignments; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.assignments (id, title, description, class_subject_id, created_by_teacher_id, deadline, max_marks, status, published_at, allow_resubmission, allow_late_submission, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, description_json, grading_type) VALUES ('09365cfb-8e61-06f1-9f0e-efe1edd35ecf', 'Quadratic Equations Problem Set', 'Solve problems 1-15 from chapter 4. Show every step of your working; answers without derivations receive partial credit only.', '66ce2c9b-f69d-6712-20d8-1f97cf973b90', 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', '2026-08-14 09:54:10.997229+00', 100.00, 'published', '2026-08-04 09:54:10.997229+00', true, false, '2026-08-07 09:54:11.031865+00', NULL, NULL, NULL, false, NULL, NULL, NULL, 1);
INSERT INTO public.assignments (id, title, description, class_subject_id, created_by_teacher_id, deadline, max_marks, status, published_at, allow_resubmission, allow_late_submission, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, description_json, grading_type) VALUES ('14a597b9-f4a3-e64b-cb4d-c549c41e8865', 'Newton''s Laws Lab Report', 'Write up the inclined-plane experiment. Include your hypothesis, method, measurements, error analysis and conclusion.', 'ecfa6ff0-ac96-5f50-04b9-6b165a50aace', 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', '2026-08-09 09:54:10.997229+00', 50.00, 'published', '2026-08-02 09:54:10.997229+00', true, false, '2026-08-07 09:54:11.031865+00', NULL, NULL, NULL, false, NULL, NULL, NULL, 1);
INSERT INTO public.assignments (id, title, description, class_subject_id, created_by_teacher_id, deadline, max_marks, status, published_at, allow_resubmission, allow_late_submission, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, description_json, grading_type) VALUES ('3d37efc7-17ae-2379-4b96-dbb9c12015d1', 'Trigonometry Worksheet', 'Draft — identities and the unit circle. Not yet released to students.', '66ce2c9b-f69d-6712-20d8-1f97cf973b90', 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', '2026-08-21 09:54:10.997229+00', 75.00, 'draft', NULL, true, false, '2026-08-07 09:54:11.031865+00', NULL, NULL, NULL, false, NULL, NULL, NULL, 1);
INSERT INTO public.assignments (id, title, description, class_subject_id, created_by_teacher_id, deadline, max_marks, status, published_at, allow_resubmission, allow_late_submission, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, description_json, grading_type) VALUES ('f38ebf8e-26b5-ae13-0822-8a839703f451', 'Normalization Exercise', 'Normalise the supplied schema to third normal form. State every functional dependency you rely on and justify each decomposition.', 'b1779c05-10d5-05a5-d76d-0c373c805c6a', '506d4915-e7f3-53bd-7dcd-edc53c1fb224', '2026-08-05 09:54:10.997229+00', 40.00, 'published', '2026-07-24 09:54:10.997229+00', false, true, '2026-08-07 09:54:11.031865+00', NULL, NULL, NULL, false, NULL, NULL, NULL, 1);
--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.enrollments (id, student_id, class_id, enrolled_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('0f0b0aca-1f8b-bbb2-0a40-ed3c19ebf01c', 'b38fbc94-db9c-efb2-2647-f868ad9773eb', '57373f3a-bacb-3856-e22a-8b8c0034b7d4', '2026-08-07 09:54:10.935624+00', '2026-08-07 09:54:10.986933+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.enrollments (id, student_id, class_id, enrolled_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('54db2076-0707-829f-ef76-bf1f67472998', '8dc10129-cf00-d645-5211-4e19a86bdd90', '188c7e35-1a9a-271e-9589-cf3b2e837993', '2026-08-07 09:54:10.935624+00', '2026-08-07 09:54:10.986933+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.enrollments (id, student_id, class_id, enrolled_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('b78684d7-fb4c-a028-9fb8-52f4fd8f62b4', 'b62f607f-27c0-06bf-818b-b2243761e367', '57373f3a-bacb-3856-e22a-8b8c0034b7d4', '2026-08-07 09:54:10.935624+00', '2026-08-07 09:54:10.986933+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: rubric_criteria; Type: TABLE DATA; Schema: public; Owner: -
--
--
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.submissions (id, assignment_id, student_id, content, attachment_url, submitted_at, last_updated_at, is_late, status, marks, graded_by_teacher_id, graded_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, content_json) VALUES ('2d9d28be-1939-1b89-75fe-1073fe8e1579', 'f38ebf8e-26b5-ae13-0822-8a839703f451', '8dc10129-cf00-d645-5211-4e19a86bdd90', 'The relation violates 2NF: Address depends on StudentId alone rather than on the full key (StudentId, CourseId). Decomposed into Student, Course and Enrolment; the transitive dependency Department -> DeptHead is removed in 3NF.', NULL, '2026-08-07 03:54:11.057654+00', NULL, true, 'under_review', NULL, NULL, NULL, '2026-08-07 09:54:11.094382+00', NULL, NULL, NULL, false, NULL, NULL, NULL);
INSERT INTO public.submissions (id, assignment_id, student_id, content, attachment_url, submitted_at, last_updated_at, is_late, status, marks, graded_by_teacher_id, graded_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, content_json) VALUES ('3a03b690-1901-4bd1-8f78-00dfc246498c', '09365cfb-8e61-06f1-9f0e-efe1edd35ecf', 'b62f607f-27c0-06bf-818b-b2243761e367', 'Q1: x = 3 or x = -5.
Q2: x = 2 and x = -1.5.
Q3 onwards solved using the quadratic formula throughout.', NULL, '2026-08-05 09:54:11.057654+00', NULL, false, 'graded', 85.00, 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', '2026-08-06 15:54:11.057654+00', '2026-08-07 09:54:11.094382+00', NULL, NULL, NULL, false, NULL, NULL, NULL);
INSERT INTO public.submissions (id, assignment_id, student_id, content, attachment_url, submitted_at, last_updated_at, is_late, status, marks, graded_by_teacher_id, graded_at, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by, content_json) VALUES ('bb300c61-2db1-e063-15d5-5d1f06556c68', '09365cfb-8e61-06f1-9f0e-efe1edd35ecf', 'b38fbc94-db9c-efb2-2647-f868ad9773eb', 'Q1: x = 3 or x = -5, by factorising x^2 + 2x - 15 = (x + 5)(x - 3).
Q2: Discriminant is 49, so two distinct real roots: x = 2 and x = -1.5.
(Full working for the remaining questions attached.)', NULL, '2026-08-06 09:54:11.057654+00', NULL, false, 'submitted', NULL, NULL, NULL, '2026-08-07 09:54:11.094382+00', NULL, NULL, NULL, false, NULL, NULL, NULL);
--
-- Data for Name: submission_criterion_scores; Type: TABLE DATA; Schema: public; Owner: -
--
--
-- Data for Name: submission_events; Type: TABLE DATA; Schema: public; Owner: -
--
--
-- Data for Name: submission_feedbacks; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.submission_feedbacks (id, submission_id, teacher_id, comment, marks_at_time, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('b676c953-f562-7875-6986-e3dde3bdb545', '3a03b690-1901-4bd1-8f78-00dfc246498c', 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', 'Correct answers throughout and clearly presented. Marks withheld on Q7 and Q11 because the working jumps straight to the result — show the intermediate steps and this is full marks next time.', 85.00, '2026-08-07 09:54:11.126428+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- Data for Name: submission_versions; Type: TABLE DATA; Schema: public; Owner: -
--
--
-- Data for Name: teacher_assignments; Type: TABLE DATA; Schema: public; Owner: -
--
INSERT INTO public.teacher_assignments (id, teacher_id, class_subject_id, assigned_at, assigned_by_user_id, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('075ad328-6171-84b6-02b3-33bbaeb71a99', 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', '66ce2c9b-f69d-6712-20d8-1f97cf973b90', '2026-08-07 09:54:10.935624+00', 'af138ed3-4503-7170-1560-c16b5d056f3f', '2026-08-07 09:54:10.957887+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.teacher_assignments (id, teacher_id, class_subject_id, assigned_at, assigned_by_user_id, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('3cad10c8-3545-6eed-68fe-9623d2dc4010', '506d4915-e7f3-53bd-7dcd-edc53c1fb224', 'b1779c05-10d5-05a5-d76d-0c373c805c6a', '2026-08-07 09:54:10.935624+00', 'af138ed3-4503-7170-1560-c16b5d056f3f', '2026-08-07 09:54:10.957887+00', NULL, NULL, NULL, false, NULL, NULL);
INSERT INTO public.teacher_assignments (id, teacher_id, class_subject_id, assigned_at, assigned_by_user_id, created_at, updated_at, created_by, modified_by, is_deleted, deleted_at, deleted_by) VALUES ('3ea5dca1-64d1-4100-d1b0-b50acc40ade3', 'b6218b0e-ec59-0bdc-08aa-0f57671ad237', 'ecfa6ff0-ac96-5f50-04b9-6b165a50aace', '2026-08-07 09:54:10.935624+00', 'af138ed3-4503-7170-1560-c16b5d056f3f', '2026-08-07 09:54:10.957887+00', NULL, NULL, NULL, false, NULL, NULL);
--
-- PostgreSQL database dump complete
--
\unrestrict aJhkaOSve7JEPGkNeHzmzdbaMYPyBfl6s8E5YfGa1o9npK5hLysOdJBAMzt7DFT

COMMIT;
