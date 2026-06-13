-- 더미 데이터: doyeonkim1205@gmail.com (dev 전용)
-- USER b90d30f7-2c29-483e-894d-186b8923d2d1 / DOG 멍멍이 f6656bbb... / CAT 냥냥이 b106eab0...
-- 모든 기능 탭을 한 번에 확인할 수 있게 최근 ~30일치 채움.

BEGIN;

-- 0) 재실행 대비: 이 더미 범위 정리 (펫 메타는 UPDATE 라 제외)
DELETE FROM medication_checks WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM medications       WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM health_records    WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM preventive_cares  WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM excretion_logs    WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM health_metrics    WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM metric_targets    WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM weight_logs       WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';
DELETE FROM expenses          WHERE user_id = 'b90d30f7-2c29-483e-894d-186b8923d2d1';

-- 1) 펫 메타 채우기
UPDATE pets SET breed='말티즈', birth_date='2021-05-20', sex='male', neutered=true, weight=4.1,
  chronic_conditions=ARRAY['슬개골 탈구']::text[]
 WHERE id='f6656bbb-f592-4e24-ba50-a9e824c483c9';
UPDATE pets SET breed='코리안숏헤어', birth_date='2022-09-10', sex='female', neutered=true, weight=3.8,
  chronic_conditions=NULL
 WHERE id='b106eab0-5e47-4680-bdd5-92e58eb4de02';

-- 2) 건강 기록 (진료/증상/입퇴원/일상)
INSERT INTO health_records (user_id,pet_id,record_type,title,description,hospital_name,visit_date,cost,weight,next_appointment_date,discharge_date,symptom_time) VALUES
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','visit','정기 건강검진','전반적으로 양호. 체중 관리 권장.','행복동물병원',CURRENT_DATE-20,85000,4.3,CURRENT_DATE+40,NULL,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','symptom','구토 증상','아침에 사료를 토함. 기운은 있음.',NULL,CURRENT_DATE-12,NULL,NULL,NULL,NULL,'아침'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','hospitalization','장염 입원','수액 치료 후 호전되어 퇴원.','24시 동물메디컬센터',CURRENT_DATE-8,320000,4.0,NULL,CURRENT_DATE-6,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','visit','재진','경과 양호. 약 처방.','행복동물병원',CURRENT_DATE-3,30000,4.1,NULL,NULL,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','daily','산책 30분','컨디션 좋고 잘 걸음.',NULL,CURRENT_DATE-1,NULL,NULL,NULL,NULL,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','b106eab0-5e47-4680-bdd5-92e58eb4de02','visit','예방접종','종합백신 2차 접종.','고양이전문 동물병원',CURRENT_DATE-15,45000,3.8,NULL,NULL,NULL);

-- 3) 복약 (고정 UUID 로 체크 연결)
INSERT INTO medications (id,user_id,pet_id,name,dosage,kind,start_date,end_date,frequency,alarm_enabled,alarm_times,color) VALUES
 ('11111111-1111-1111-1111-111111111101','b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','소화제','1정','prescription',CURRENT_DATE-12,CURRENT_DATE-2,'1일 2회',true,'["09:00","19:00"]'::jsonb,'#EC4899'),
 ('11111111-1111-1111-1111-111111111102','b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','유산균','1포','supplement',CURRENT_DATE-12,NULL,'1일 1회',true,'["08:00"]'::jsonb,'#22C55E'),
 ('11111111-1111-1111-1111-111111111103','b90d30f7-2c29-483e-894d-186b8923d2d1','b106eab0-5e47-4680-bdd5-92e58eb4de02','관절 영양제','1정','supplement',CURRENT_DATE-10,NULL,'1일 1회',true,'["10:00"]'::jsonb,'#3B82F6');

-- 4) 복약 체크 (지난 며칠치, 일부 완료)
INSERT INTO medication_checks (medication_id,user_id,check_date,checked,checked_at,dose_number)
 SELECT '11111111-1111-1111-1111-111111111101'::uuid,'b90d30f7-2c29-483e-894d-186b8923d2d1'::uuid,d::date,true,(d + time '09:05')::timestamptz,0
   FROM generate_series(CURRENT_DATE-9, CURRENT_DATE-3, interval '1 day') d
 UNION ALL
 SELECT '11111111-1111-1111-1111-111111111101'::uuid,'b90d30f7-2c29-483e-894d-186b8923d2d1'::uuid,d::date,true,(d + time '19:10')::timestamptz,1
   FROM generate_series(CURRENT_DATE-9, CURRENT_DATE-3, interval '1 day') d
 UNION ALL
 SELECT '11111111-1111-1111-1111-111111111102'::uuid,'b90d30f7-2c29-483e-894d-186b8923d2d1'::uuid,d::date,true,(d + time '08:05')::timestamptz,0
   FROM generate_series(CURRENT_DATE-9, CURRENT_DATE-1, interval '1 day') d;

-- 5) 예방 관리
INSERT INTO preventive_cares (user_id,pet_id,category,name,last_done_date,interval_unit,interval_value,next_due_date,alarm_enabled,memo) VALUES
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','vaccine','종합백신(DHPPL)',CURRENT_DATE-60,'year',1,CURRENT_DATE+305,true,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','rabies','광견병',CURRENT_DATE-90,'year',1,CURRENT_DATE+275,true,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','heartworm','하트가드(심장사상충)',CURRENT_DATE-25,'month',1,CURRENT_DATE+5,true,'매월 같은 날'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','health_check','종합 건강검진',CURRENT_DATE-200,'year',1,CURRENT_DATE+165,true,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','b106eab0-5e47-4680-bdd5-92e58eb4de02','vaccine','종합백신',CURRENT_DATE-40,'year',1,CURRENT_DATE+325,true,NULL);

-- 6) 대소변 (지난 7일, 일부 이상)
INSERT INTO excretion_logs (user_id,pet_id,kind,condition,amount,color,memo,measured_at) VALUES
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','poop','normal','normal','brown',NULL,(CURRENT_DATE-6)::timestamp + time '08:30'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','poop','soft','less','brown','조금 무름',(CURRENT_DATE-4)::timestamp + time '09:10'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','poop','diarrhea','less','yellow','설사, 병원 감',(CURRENT_DATE-2)::timestamp + time '07:50'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','poop','normal','normal','brown',NULL,(CURRENT_DATE-1)::timestamp + time '08:20'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','pee','normal','normal',NULL,NULL,(CURRENT_DATE-2)::timestamp + time '07:55'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','pee','dark','less',NULL,'색 진함',(CURRENT_DATE-1)::timestamp + time '20:00');

-- 7) 정량 목표 + 식사/음수/수액 지표
INSERT INTO metric_targets (user_id,pet_id,metric_type,serving,unit) VALUES
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','food',150,'g'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','fluid',200,'ml');

INSERT INTO health_metrics (user_id,pet_id,metric_type,value,unit,input_pct,serving_snapshot,memo,measured_at) VALUES
 -- 식사 (정량 150g 대비 %)
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','food',150,'g',100,150,NULL,(CURRENT_DATE-4)::timestamp + time '08:00'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','food',112.5,'g',75,150,'입맛 조금 없음',(CURRENT_DATE-3)::timestamp + time '08:10'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','food',75,'g',50,150,'아파서 적게 먹음',(CURRENT_DATE-2)::timestamp + time '08:05'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','food',150,'g',100,150,NULL,(CURRENT_DATE-1)::timestamp + time '08:00'),
 -- 음수 (자유급식, % 없음)
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','water',320,'ml',NULL,NULL,NULL,(CURRENT_DATE-3)::timestamp + time '21:00'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','water',280,'ml',NULL,NULL,NULL,(CURRENT_DATE-2)::timestamp + time '21:00'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','water',300,'ml',NULL,NULL,NULL,(CURRENT_DATE-1)::timestamp + time '21:30'),
 -- 수액 (정량 200ml 대비 %)
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','fluid',200,'ml',100,200,'입원 중',(CURRENT_DATE-7)::timestamp + time '14:00'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','fluid',150,'ml',75,200,NULL,(CURRENT_DATE-6)::timestamp + time '14:00');

-- 8) 체중 추이
INSERT INTO weight_logs (user_id,pet_id,weight,measured_at,memo) VALUES
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9',4.5,CURRENT_DATE-30,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9',4.3,CURRENT_DATE-20,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9',4.0,CURRENT_DATE-8,'입원 중'),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9',4.1,CURRENT_DATE-1,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','b106eab0-5e47-4680-bdd5-92e58eb4de02',3.9,CURRENT_DATE-25,NULL),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','b106eab0-5e47-4680-bdd5-92e58eb4de02',3.8,CURRENT_DATE-10,NULL);

-- 9) 지출 (의료비는 health_records.cost 에서 자동 합산되므로 비의료 카테고리 위주)
INSERT INTO expenses (user_id,pet_id,category,reason,amount,spent_at) VALUES
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','food','로얄캐닌 미니 어덜트 2kg',38000,CURRENT_DATE-7),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','snack','북어 트릿',12000,CURRENT_DATE-5),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','supplies','노즈워크 장난감',15000,CURRENT_DATE-10),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','grooming','목욕+부분미용',45000,CURRENT_DATE-5),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','f6656bbb-f592-4e24-ba50-a9e824c483c9','insurance','펫보험 월 납입',30000,CURRENT_DATE-1),
 ('b90d30f7-2c29-483e-894d-186b8923d2d1','b106eab0-5e47-4680-bdd5-92e58eb4de02','food','고양이 사료 1.5kg',32000,CURRENT_DATE-6);

COMMIT;
