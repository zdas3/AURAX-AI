import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase Client initialized successfully in Backend Auth.");
  } catch (err) {
    console.error("Failed to initialize Supabase client. Fallback mode enabled.", err.message);
  }
}

// Local In-Memory Fallback DB
const localDB = {
  users: new Map(), // email -> user info
  savedSetups: [],   // list of saved setups
  watchlists: new Map() // email -> array of items
};

// Seed local DB with a demo user
localDB.users.set("demo@aurax.ai", {
  id: "USR_DEMO_99",
  email: "demo@aurax.ai",
  password: "password123",
  fullName: "Premium Trader",
  subscription: "Elite Institutional"
});
localDB.watchlists.set("demo@aurax.ai", ["XAUUSD", "DXY", "US10Y"]);

// 1. Sign Up
router.post('/signup', async (req, res) => {
  const { email, password, fullName } = req.body;
  
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { fullName }
        }
      });
      if (error) throw error;
      return res.json({ message: "Registration successful. Please verify email.", user: data.user });
    } catch (apiErr) {
      console.warn("Supabase SignUp failed. Attempting local registration.", apiErr.message);
    }
  }

  // Local Fallback
  if (localDB.users.has(email)) {
    return res.status(400).json({ error: "User already exists." });
  }

  const newUser = {
    id: "USR_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    email,
    password,
    fullName,
    subscription: "Free Trial"
  };
  
  localDB.users.set(email, newUser);
  localDB.watchlists.set(email, ["XAUUSD"]);
  
  return res.json({
    message: "Registration successful (Simulated Mode).",
    user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName, subscription: newUser.subscription }
  });
});

// 2. Log In
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      return res.json({
        message: "Login successful",
        session: data.session,
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.fullName || "Institutional Trader",
          subscription: "Elite Institutional"
        }
      });
    } catch (apiErr) {
      console.warn("Supabase LogIn failed. Attempting local login.", apiErr.message);
    }
  }

  // Local Fallback
  const user = localDB.users.get(email);
  if (!user || user.password !== password) {
    return res.status(400).json({ error: "Invalid email or password." });
  }

  return res.json({
    message: "Login successful (Simulated Mode)",
    session: { access_token: "SIMULATED_TOKEN_" + user.id, expires_in: 3600 },
    user: { id: user.id, email: user.email, fullName: user.fullName, subscription: user.subscription }
  });
});

// 3. Saved Setups (Get, Save, Delete)
router.get('/setups', (req, res) => {
  res.json(localDB.savedSetups);
});

router.post('/setups', (req, res) => {
  const setup = req.body;
  setup.savedAt = new Date().toISOString();
  setup.id = setup.id || "SAV_" + Math.random().toString(36).substr(2, 9).toUpperCase();
  localDB.savedSetups.unshift(setup);
  res.json({ success: true, savedSetup: setup });
});

router.delete('/setups/:id', (req, res) => {
  const { id } = req.params;
  localDB.savedSetups = localDB.savedSetups.filter(s => s.id !== id);
  res.json({ success: true, message: "Setup deleted." });
});

// 4. Watchlists
router.get('/watchlist', (req, res) => {
  const email = req.query.email || "demo@aurax.ai";
  const list = localDB.watchlists.get(email) || ["XAUUSD"];
  res.json(list);
});

router.post('/watchlist', (req, res) => {
  const { email, symbol } = req.body;
  const userEmail = email || "demo@aurax.ai";
  const list = localDB.watchlists.get(userEmail) || [];
  
  if (!list.includes(symbol)) {
    list.push(symbol);
    localDB.watchlists.set(userEmail, list);
  }
  
  res.json(list);
});

router.delete('/watchlist', (req, res) => {
  const { email, symbol } = req.body;
  const userEmail = email || "demo@aurax.ai";
  let list = localDB.watchlists.get(userEmail) || [];
  
  list = list.filter(item => item !== symbol);
  localDB.watchlists.set(userEmail, list);
  
  res.json(list);
});

export default router;
