-- 건강 기록
INSERT INTO health_records (user_id, pet_id, record_type, title, description, hospital_name, visit_date, cost, weight, color) VALUES
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 'visit', '정기 건강검진', '혈액검사, 소변검사 모두 정상. 체중 약간 증가 주의.', '서울동물병원', '2026-04-10', 85000, 4.8, '#3B82F6'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 'symptom', '구토 증상', '아침에 사료를 먹고 30분 후 구토. 노란 거품 섞여있음.', NULL, '2026-04-05', NULL, 4.7, '#F97316'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 'visit', '예방접종 (종합백신)', '종합백신 5차 접종 완료. 다음 접종은 1년 후.', '행복한동물병원', '2026-04-08', 45000, 7.2, '#3B82F6'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 'visit', '피부 진료', '등 부위 탈모 증상. 알러지성 피부염 의심.', '행복한동물병원', '2026-03-25', 120000, 7.0, '#3B82F6'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 'visit', '스케일링', '치석 제거 및 구강 검진. 잇몸 상태 양호.', '서울동물병원', '2026-03-15', 250000, 4.5, '#3B82F6'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 'symptom', '설사 증상', '물 설사 2회. 간식을 바꾼 후 발생.', NULL, '2026-03-20', NULL, 7.1, '#F97316'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 'hospitalization', '중성화 수술', '중성화 수술 진행. 수술 경과 양호.', '서울동물병원', '2026-02-20', 350000, 4.3, '#22C55E');

-- 체중 로그 (살구)
INSERT INTO weight_logs (user_id, pet_id, weight, measured_at) VALUES
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 4.1, '2026-01-05'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 4.25, '2026-01-20'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 4.6, '2026-03-01'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 4.7, '2026-03-20'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'f0c3d7c3-77ea-4a33-aebb-1ff3a566292b', 4.85, '2026-04-12');

-- 체중 로그 (이브)
INSERT INTO weight_logs (user_id, pet_id, weight, measured_at) VALUES
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 6.8, '2026-01-10'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 6.9, '2026-02-05'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 7.05, '2026-03-10'),
('c0266d3a-5205-4acd-ad76-5b71b5b046ab', 'dd10d118-213d-4aae-a38b-4e9094e2eb48', 7.15, '2026-04-05');
