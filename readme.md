# Paperfume_Server

페이퍼퓸 프로젝트 의 책데이터 크롤링 및 유저데이터 관리 등을 처리하는 어플리케이션 입니다.

필요사항
=============

* [nodejs](http://nodejs.org/)

설치
================

### 소스 다운로드

    $ git clone git@bitbucket.org:sangyeonK/paperfume_server.git
    
### npm package 설치

    $ cd Paperfume_Server && npm install
  
### 포트번호 수정

포트번호는 `app.js` 파일의 `var port = 8082;` 변수로 기록되어 있습니다.
기본값은 8082 으로 되어 있으며 변경이 필요할 시 원하는 값으로 변경하면 됩니다.

### firebase 인증키
`firebase-credential.json` 파일을 `./credentials` 폴더에 위치시켜야 합니다.
해당 파일은 프로젝트 관리자 에게 문의해 주십시오.

실행
================

    $ node app.js
