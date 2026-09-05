-- Placeholder family data. Edit names to match your kids and schools.
-- Kids: 豬1 / 豬2 as in the product plan.

INSERT INTO children (id, name, nickname, grade) VALUES
  (1, '豬1', 'Pig1', NULL),
  (2, '豬2', 'Pig2', NULL);

INSERT INTO organisations (id, name, type, notes) VALUES
  (1, '學校 A', 'school', 'Replace with first school name'),
  (2, '學校 B', 'school', 'Replace with second school name'),
  (3, '學校 C', 'school', 'Replace with third school name'),
  (4, '數學補習', 'tutorial', 'Replace with maths centre'),
  (5, '英文補習', 'tutorial', 'Replace with English centre'),
  (6, '鋼琴', 'tutorial', 'Replace with extra tutorial / music');

-- 豬1 at schools A+B and maths + piano; 豬2 at schools A+C and English.
INSERT INTO child_organisations (child_id, organisation_id) VALUES
  (1, 1),
  (1, 2),
  (1, 4),
  (1, 6),
  (2, 1),
  (2, 3),
  (2, 5);

-- Standing weekly timetable (weekday: 0=Sun ... 6=Sat, Hong Kong).
INSERT INTO timetable (child_id, organisation_id, title, weekday, start_time, end_time, location, items_to_bring, notes) VALUES
  (1, 4, '數學補習', 1, '16:30', '18:00', '數學補習', '["功課冊"]', NULL),
  (1, 6, '鋼琴', 4, '17:00', '17:45', '鋼琴室', '["琴譜"]', NULL),
  (1, 1, 'PE / 體育', 5, '08:00', '09:00', '學校 A', '["白鞋","水"]', 'Regular PE day'),
  (2, 5, '英文補習', 3, '16:30', '18:00', '英文補習', '["英文書"]', NULL),
  (2, 3, 'PE / 體育', 2, '08:00', '09:00', '學校 C', '["白鞋","水"]', 'Regular PE day');
