import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mongoose } from "mongoose";

const TARGETLIST = {
  nasdaq: "nasdaq",
  nyse: "nyse",
  amex: "amex",
};

const API_LIMIT = 25;

class App {
  #date;
  constructor() {
    this.#date = this.#getDateFormat(new Date(Date.now()));
    mongoose.connect("mongodb://127.0.0.1:27017/americastock").then((result) => {
      console.log("MongoDB 연결 성공!")
    }).catch((e) => {
      throw new Error("MongoDB 연결 실패, 앱을 종료합니다!");
    })
  }
  #getDateFormat(date) {
    // Note: 메서드 명칭들이 직관적이지 않다는 점에 주의(웹 검색 필요)
    return `${date.getFullYear()}-${date.getMonth() < 9 ? "0" : ""}${date.getMonth() + 1}-${date.getDate() < 9 ? "0" : ""}${date.getDate()}`;
  }
  async fetchMetadata(target) {
    let result = await fetch(`https://api.nasdaq.com/api/screener/stocks?tableonly=true&offset=0&exchange=${target}&download=true`);
    result = await result.json();
    if (!existsSync(`result/metadata/${target}_${this.#date}.json`)) {
      writeFileSync(`result/metadata/${target}_${this.#date}.json`, JSON.stringify(result, null, 1), {
        encoding: "utf8",
        flag: "w+",
      });
    }
    return result.data.rows;
  }
  async fetchInfo(url) {
    if (!existsSync(`result/${result["Meta Data"]["2. Symbol"]}_${this.#date}.json`)) {
      let result = await fetch(url);
      result = await result.json();
      writeFileSync(`result/${result["Meta Data"]["2. Symbol"]}_${this.#date}.json`, JSON.stringify(result, null, 1), {
        encoding: "utf8",
        flag: "w+",
      });
      return result["Time Series (Daily)"];
    }
  }
  async run() {
    // DB 스키마 생성하고 모델화
    const schema = mongoose.Schema({name: String, code: {type: String, required:true} , price: {type: String, required:true}, date: {type: Date, required:true}}, {collection:"stock"});
    const stockPrice = mongoose.model("StockPrice", schema);

    // API URL에 파라미터로 넣을 키 가져오기기
    const apiKey = readFileSync("../APIKey.json").toJSON().key; // key 가져옴
    let limitCounter = 0; // API_LIMIT까지 increase

    // 메타데이터 배열 가져오기(오늘의 주식 가격들을 포함)
    const nasdaqlist = await this.fetchMetadata(TARGETLIST.nasdaq);
    const nyselist = await this.fetchMetadata(TARGETLIST.nyse);
    const amexlist = await this.fetchMetadata(TARGETLIST.amex);
    console.log("Fetched metadata and today's data");
    // nasdaq, nyse, amex를 융합한 배열열 제작
    let totalStocks = [];
    totalStocks = totalStocks.concat(nasdaqlist, nyselist, amexlist);
    // 위 오브젝트의 entries에 대해해 루프 돌면서 다음을 수행
      // 1. MongoDB에 질의하여 주어진 티커 코드를 키로 가진 필드가 존재하는지 질의
      // 2. 필드가 이미 있으면 나스닥에서 가져온온 오늘의 날짜 데이터를를 업데이트함.
      // 3. 쿼리 결과가 1095개(3년치 기록)보다 많은지 확인
      // 4-1. 쿼리 결과가 1095개보다 적을 때 limitCounter가 API_LIMIT보다 작을 때 알파밴티지에 일자별 가격 기록을 질의
      // 4-2. 4-1번에 따라 가격 기록을 질의했다면 컬렉션에 필드로 기록하고 limitCounter를 +1
      // 4-3. 질의에 실패한 경우 limitCounter를 API_LIMIT로 설정하기
      // 5. 루프를 계속 수행행
    console.log("Start writing...");
    for (const item of totalStocks) {
      const instance = new stockPrice({name: item.name, code: item.symbol, price: item.lastsale.substr(1), date: this.#date });
      try {
        await instance.save();
        console.log(instance);
      } catch (e) {
          console.error(e);
      }
      const query = await stockPrice.find({code: item.symbol});
      if (query.length < 1095 && limitCounter < API_LIMIT) { // 3년치가 안 되는 데이터 발견 시 알파밴티지에 요청
        /*
          const historyResult = await this.fetchInfo(
            `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${item.symbol}&outputsize=full&apikey=${apiKey}`
          );
          for (const [key, value] of Object.entries(historyResult["Time Series (Daily)"])) {
            const historyInstance = new stockPrice({name: item.name, code: item.symbol, price: value["4. close"], date: key});
          }
        */
        limitCounter = limitCounter + 1;
      }
    }

    mongoose.disconnect();
  }
}

const app = new App();
await app.run();