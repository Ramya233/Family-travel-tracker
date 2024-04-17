import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
import ejs from "ejs";
import { fileURLToPath } from "url";
import path from "path";
import { dirname, join } from "path";
import cors from "cors";
import env from "dotenv";
import { sql } from "@vercel/postgres";

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
env.config();


const pool = new Pool({
  connectionString: process.env.POSTGRES_URL + "?sslmode=require",
});

pool.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Error connecting to the database', err));

app.use(cors());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static("public"));
app.use(express.static(__dirname + "/public/"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisisted() {
  const result = await pool.query(
    "SELECT country_code FROM visited_countries_ftt JOIN users ON users.id = user_id WHERE user_id = $1;", 
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function getCurrentUser() {
  const result = await pool.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();
  try {
    const result = await pool.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = $1;",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log(`Country not found: ${input}`);
      return res.redirect("/");
    }

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await pool.query(
        "INSERT INTO visited_countries_ftt (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
      res.redirect("/");
    }
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});
app.post("/user", async (req, res) => {
  if(req.body.add === "new"){
    res.render("new.ejs");
  }else{
  currentUserId = req.body.user;
  res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
  const name = req.body.name;
  const color = req.body.color;
  const result = await pool.query(
    "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *;", 
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
