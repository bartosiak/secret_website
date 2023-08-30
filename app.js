const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const LocalStrategy = require("passport-local").Strategy;
require("dotenv").config();
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require("passport-facebook").Strategy;

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "Ouur little secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB", { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { id: user.id, username: user.username, name: user.name });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:3000/auth/facebook/secrets",
      userProfileURL: "https://graph.facebook.com/v2.11/me",
      enableProof: true,
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ facebookId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);
app.get("/auth/facebook", passport.authenticate("facebook"));

app.get(
  "/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});
app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/secrets", async function (req, res) {
  try {
    const foundUsers = await User.find({ secret: { $ne: null } });
    if (foundUsers && foundUsers.length > 0) {
      res.render("secrets", { usersWithSecrets: foundUsers });
    } else {
      res.render("secrets", { usersWithSecrets: [] });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Wystąpił błąd podczas pobierania sekretów.");
  }
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", async function (req, res) {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }

    const userId = req.user.id;
    const secret = req.body.secret;

    await User.findByIdAndUpdate(userId, { $set: { secret: secret } });
    res.redirect("/secrets");
  } catch (err) {
    console.log(err);
    res.redirect("/secrets");
    błędu;
  }
});

app.post("/register", async function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  try {
    await User.register({ username: username }, password);
    passport.authenticate("local")(req, res, function () {
      res.redirect("/secrets");
    });
  } catch (err) {
    console.log("Registration error:", err.message);
    res.redirect("/register");
  }
});
app.post("/login", async function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  try {
    const user = await User.findOne({ username: username });

    if (!user) {
      return res.redirect("/login");
    }

    const isAuthenticated = await user.authenticate(password);

    if (isAuthenticated) {
      req.login(user, function (err) {
        if (err) {
          return res.redirect("/login");
        }
        return res.redirect("/secrets");
      });
    } else {
      return res.redirect("/login");
    }
  } catch (err) {
    console.log(err);
    return res.redirect("/login");
  }
});

app.listen(3000, function () {});
