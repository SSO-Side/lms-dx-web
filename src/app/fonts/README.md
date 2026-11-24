# fonts

- `PretendardVariable.subset.woff2` — Pretendard 가변 폰트(v1.3.9, npm `pretendard` 패키지의 `dist/web/variable/woff2/PretendardVariable.woff2`)를 줄인 파일(약 360KB, 원본 2MB).
  - 굵기 400~700만 남김 (디자인 규칙: 400/500/600 사용).
  - 글자: 한글 KS X 1001 2,350자 + 자모 + 라틴·숫자·문장부호·기호·화살표. 이 밖의 글자(희귀 한글 음절, 한자 등)는 `globals.css` 폰트 스택의 다음 글꼴(맑은 고딕, Apple SD Gothic Neo)로 대신 표시된다.
  - 숫자 고정폭(`tabular-nums`)과 자간 조정 등 OpenType 기능은 유지.
- `make-subset.py` — 위 파일을 다시 만드는 방법. Python의 `fonttools`, `brotli` 필요(프로젝트 의존성 아님): `python make-subset.py <원본.woff2> <중간.ttf> <결과.woff2>`
- `PRETENDARD-LICENSE.txt` — SIL Open Font License 1.1 (폰트와 함께 배포할 때 필요).
