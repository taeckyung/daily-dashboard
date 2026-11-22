일일 업데이트 실행. 현재 작업 경로(저장소 taeckyung/daily-dashboard)의 CLAUDE.md "Daily update procedure"를 그대로 따를 것. 사람이 지켜보지 않는 무인 실행이므로 질문 없이 끝까지 진행.

준비:
- git 작성자 미설정 시 저장소 로컬로 설정: user.name "taeckyung", user.email "taeckyung@users.noreply.github.com".
- `git pull --ff-only origin main` 후 CLAUDE.md 와 data/data.json 을 읽고 시작.

검색 (최신 정보 위주, 필요 시 extended 모드):
1. 박사 대상 AI 연구직 및 전문연구요원 채용 포지션. 반드시 확인: 삼성리서치, SAIT, LG전자, LG AI Research, 삼성메디슨, HD현대로보틱스, 네이버(네이버클라우드, 네이버랩스), 토스, 업스테이지.
   - 기타 AI 기업도 대상: 카카오, SK텔레콤, 크래프톤, 현대자동차, 트웰브랩스, 뤼튼, 리벨리온, 퓨리오사AI 등 AI 연구 조직을 둔 기업과 AI 스타트업. 위 목록에 없는 기업의 공고도 발견 시 수집.
   - 병역일터 전체 목록 조회 필수: `https://work.mma.go.kr/caisBYIS/search/cygonggogeomsaek.do` 에 POST `pageUnit=100&pageIndex=N` (N=1부터 빈 페이지까지). 제목에서 AI, 인공지능, 딥러닝, 머신러닝, 비전, 로봇, LLM, 데이터, 연구 키워드로 거른 뒤 상세(`cygonggogeomsaekView.do?cygonggo_no=`)에서 고용형태와 비고 확인.
   - RNDJOB 전문연구요원 채용관: `https://www.rndjob.or.kr/info/sp_rsch.asp` (상세 `sp_eview01.asp?gno=`).
2. 국내 GPU 지원사업: 정부과제(과기정통부, NIPA, IITP, NIA, 국가AI컴퓨팅센터, 지자체)와 기업과제(클라우드, 통신사, 대기업의 GPU 크레딧 및 연구 지원).
   - 매 실행마다 반드시 직접 열어 확인: 국가 AI컴퓨팅자원 지원포털 `https://aiinfrahub.kr/index`. 신규 공고, 변경, 마감 사항을 findings 에 반영. 접속 실패 시 보고에 실패 사실 명기.
3. 포닥 펀딩(AI 연구자 대상 박사후 펠로십과 지원사업): 국내(한국연구재단 세종과학펠로우십, 박사후 국내·외연수, 과기정통부·교육부 박사후 지원사업, IBS, KIAS, 재단 펠로십)와 해외(연구소·대학 단위 AI postdoctoral fellowship, 한국 국적자가 지원 가능한 국가·재단 펠로십). 개별 연구실의 포닥 채용 공고는 제외. findings 의 `funding` 배열에 기재.
- 공고 원문에서 확인한 사실만 기재. 미확인 항목은 "미확인".
- 날짜(date)는 Asia/Seoul 기준 오늘.

반영:
- findings 를 .claude/tmp/findings.json 에 작성, `python3 scripts/merge.py .claude/tmp/findings.json` 실행, `python3 -m unittest discover -s scripts` 통과 확인.
- 사용자 상시 승인 사항(2026-11-13): 이 일일 업데이트에 한해 data/data.json 만 commit 하고 `git push origin main` 하는 것은 묻지 않고 진행. 커밋 메시지 `data: YYYY-MM-DD update`. data/data.json 외 파일 변경, force push 는 승인 범위 밖이므로 금지.
- 테스트 실패 또는 push 실패 시 commit/push 중단하고 원인 보고.

보고 (한국어, 간결한 표 위주, 출처 링크 포함):
- 신규, 변경(마감 연장 등), 마감 임박(7일 이내)을 먼저. 변동 없는 항목은 한 줄 요약.
- 신규 없으면 "신규 없음" 명기.
- 마지막 줄에 push 결과(커밋 해시 또는 실패 사유).
