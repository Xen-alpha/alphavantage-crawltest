const fs = require("node:fs");
const cors = require("cors");
const express = require("express");
const app = express({ strict: true });
const port = 8080;

app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

app.get("/", (req, res) => {
  res.status(404).send({ isSuccess: false, reason: "Not a valid URI path" });
});

app.get("/stocklist", (req, res) => {
  const reqBody = req.body;
  if (!reqBody || !reqBody.code || !reqBody.code == "") {
    res.status(400).send({ isSuccess: false, reason: "Body value not given", requestBody: req.body });
    return;
  }
  try {
    const metadata = fs.readdirSync(`result/metadata`).sort().reverse();
    const nasdaq = metadata.filter((value) => value.substring(0, 5) === "nasdaq");
    const nyse = metadata.filter((value) => value.substring(0, 3) === "nyse");
    const amex = metadata.filter((value) => value.substring(0, 3) === "amex");
    const nasdaqArray = JSON.parse(fs.readFileSync(nasdaq[0], { encoding: "utf-8" })).data.rows.map((value) => value.symbol); // read-only
    const nyseArray = JSON.parse(fs.readFileSync(nyse[0], { encoding: "utf-8" })).data.rows.map((value) => value.symbol); // read-only
    const amexArray = JSON.parse(fs.readFileSync(amex[0], { encoding: "utf-8" })).data.rows.map((value) => value.symbol); // read-only
    res.send({ isSuccess: true, result: nasdaqArray.concat(nyseArray, amexArray).sort() });
  } catch (e) {
    res.sendStatus(503).send({ isSuccess: false, reason: "Failed to read server-side data", requestBody: req.body });
    return;
  }
});

app.get("/stockinfotest", (req, res) => {
  try {
    res.sendFile(`C:/Users/Playdata/Documents/JSCode/Alphavantage/result/IBM.json`);
  } catch {
    res.status(404).send("test failed");
  }
});

app.listen(port, () => {
  console.log(`server opened in ${port}`);
});
