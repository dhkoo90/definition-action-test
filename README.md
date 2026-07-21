# 행위 정의 판별 테스트

상황 사례를 읽고 가장 잘 표현하는 행위를 선택하여, 정의 기준이 실제 사례에서도 일관되게 작동하는지 확인하는 공개 웹앱입니다.

## 현재 확정 버전

`v1.0.0` · 2026-07-21

- 54개 행위와 216개 혼합 사례
- 12문항 빠른 체험, 54문항 표준 테스트, 216문항 정밀 테스트
- 행위명·정의·핵심어 검색
- 의미별 행위 묶음과 모바일 전용 묶음 탐색
- 헷갈림 표시와 판단 메모 기록
- 브라우저 자동 저장 및 이어하기
- 85% 통과 판정
- 행위별 정확도와 오답 분석
- 결과 CSV 다운로드

확정 버전의 변경 내역은 `CHANGELOG.md`에서 확인할 수 있습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## GitHub Pages 배포

`main` 브랜치에 변경사항을 올리면 `.github/workflows/deploy-pages.yml`이 정적 페이지를 만들고 GitHub Pages에 배포합니다. 저장소의 Pages 설정에서 배포 원본을 `GitHub Actions`로 선택해야 합니다.

## 데이터

웹용 데이터는 `app/data/test-data.json`에 있으며, 공개 페이지에서는 `public/data/test-data.json`을 내려받을 수 있습니다.

- 데이터 라이선스: CC BY 4.0 (`DATA_LICENSE.md`)
- 웹앱 코드 라이선스: MIT (`LICENSE`)
