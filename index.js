require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

mongoose
  .connect(
    "mongodb+srv://demon:9oaZXDdK6Ct3EoVQ@cluster0.i2i7e.mongodb.net/OrdersDB"
  )
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  items: [
    {
      firstName: String,
      lastName: String,
      zip: String,
      adress: String,
      addedAt: { type: Date, default: Date.now },
      Payment: String,
      totalBill: Number,
    },
  ],
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model("User", userSchema);
var AmericanTotal = 0;
var itemName = [];
var TandooriTotal = 0;
var PaneerTotal = 0;
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: "mongodb://localhost:27017/OrdersDB",
    }),
  })
);

function ensureAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect("/login");
}

app.get("/", (req, res) => {
  if (req.session.userId) {
    res.render("index");
  } else {
    res.redirect("/login");
  }
});

app
  .route("/signup")
  .get((req, res) => {
    if (req.session.userId) {
      res.redirect("/");
    } else {
      res.render("signup");
    }
  })
  .post(async (req, res) => {
    try {
      const { username, password, email, phone } = req.body;
      if (!username || !password || !email || !phone) {
        return res.status(400).send("All fields are required");
      }
      const user = new User({ username, password, email, phone });
      await user.save();
      res.redirect("/login");
    } catch (err) {
      console.error("Signup error:", err);
      res.status(400).send("Error registering user");
    }
  });

var userName = "";
app
  .route("/login")
  .get((req, res) => {
    if (req.session.userId) {
      res.redirect("/");
    } else {
      res.render("login");
    }
  })
  .post(async (req, res) => {
    try {
      const { username, password } = req.body;
      userName = username;

      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }
      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.redirect("/login");
      }
      req.session.userId = user._id;
      res.redirect("/");
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).send("Error logging in");
    }
  });

app.get("/order", ensureAuthenticated, (req, res) => {
  res.render("order");
});
var total = 0;
app.post("/order", ensureAuthenticated, (req, res) => {
  itemName.push({
    "American Zinger": AmericanTotal,
    "Paneer MaKhani": PaneerTotal,
    "Tandoori Fries": TandooriTotal,
  });
  AmericanTotal = Number(req.body.A) * 100;
  TandooriTotal = Number(req.body.T) * 350;
  PaneerTotal = Number(req.body.P) * 400;
  total = AmericanTotal + TandooriTotal + PaneerTotal;
  return res.redirect("/checkout");
});

app.get("/checkout", ensureAuthenticated, (req, res) => {
  res.render("checkout", {
    American: AmericanTotal,
    Paneer: PaneerTotal,
    Tandoori: TandooriTotal,
    t: total,
  });
});
app.post("/checkout", ensureAuthenticated, async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("User not logged in");
  }

  try {
    const { Payment, firstName, lastName, zip, adress } = req.body;
    var totalBill = total;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    user.items.push({
      Payment,
      totalBill,
      firstName,
      lastName,
      zip,
      adress,
    });
    await user.save();
    res.redirect("/thanks");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding item");
  }
});
app.get("/thanks", (req, res) => {
  return res.render("thanks");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
