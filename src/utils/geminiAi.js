// Gemini AI Service for CineSync Mood-Based Recommendations
import axios from "./axios";
import requests from "./requests";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Intelligent fallback database if API key is not yet set or during network failure
const FALLBACK_VIBES = [
  {
    keywords: ["rainy", "comfort", "relax", "sunday", "warm", "cozy"],
    recommendations: [
      {
        title: "Amélie",
        year: "2001",
        reason: "Whimsical, heartwarming Parisian charm that feels like a warm cup of coffee on a gray day.",
        vibeTags: ["Whimsical", "Heartwarming"],
      },
      {
        title: "About Time",
        year: "2013",
        reason: "A tender, emotional look at love and family that leaves you deeply appreciating everyday moments.",
        vibeTags: ["Emotional", "Comfort"],
      },
      {
        title: "The Grand Budapest Hotel",
        year: "2014",
        reason: "Visual perfection and hilarious dry wit that transports you completely out of the world.",
        vibeTags: ["Vibrant", "Witty"],
      },
    ],
  },
  {
    keywords: ["sci-fi", "mind", "twist", "space", "interstellar", "inception", "complex", "physics"],
    recommendations: [
      {
        title: "Arrival",
        year: "2016",
        reason: "A profound, intellectually gripping masterpiece about language, time, and emotional connection.",
        vibeTags: ["Thought-Provoking", "Atmospheric"],
      },
      {
        title: "Coherence",
        year: "2013",
        reason: "A dinner party unravels through quantum superposition—relentlessly tense and intelligent.",
        vibeTags: ["Mind-Bending", "Intense"],
      },
      {
        title: "Ex Machina",
        year: "2014",
        reason: "A claustrophobic psychological game of chess between human ego and artificial consciousness.",
        vibeTags: ["Psychological", "Futuristic"],
      },
    ],
  },
  {
    keywords: ["action", "adrenaline", "fight", "fast", "thrill", "chase", "john wick"],
    recommendations: [
      {
        title: "Mad Max: Fury Road",
        year: "2015",
        reason: "Pure kinetic visual poetry with relentlessly inventive practical stunts.",
        vibeTags: ["High-Octane", "Masterpiece"],
      },
      {
        title: "The Raid: Redemption",
        year: "2011",
        reason: "The gold standard of martial arts action choreography inside a relentless skyscraper raid.",
        vibeTags: ["Adrenaline", "Combat"],
      },
      {
        title: "Baby Driver",
        year: "2017",
        reason: "Heist action choreographed frame-by-frame to a blistering soundtrack.",
        vibeTags: ["Stylish", "Rhythmic"],
      },
    ],
  },
  {
    keywords: ["horror", "scary", "creepy", "spooky", "dark", "eerie", "ghost"],
    recommendations: [
      {
        title: "Hereditary",
        year: "2018",
        reason: "A deeply suffocating family grief drama that transforms into unforgettable occult terror.",
        vibeTags: ["Psychological", "Terrifying"],
      },
      {
        title: "Get Out",
        year: "2017",
        reason: "Brilliant social commentary wrapped in razor-sharp psychological suspense.",
        vibeTags: ["Suspenseful", "Clever"],
      },
      {
        title: "The Witch",
        year: "2015",
        reason: "An unsettling period piece driven by folklore, paranoia, and creeping dread.",
        vibeTags: ["Atmospheric", "Eerie"],
      },
    ],
  },
  {
    keywords: ["funny", "comedy", "laugh", "friends", "party", "humor"],
    recommendations: [
      {
        title: "Superbad",
        year: "2007",
        reason: "Timeless coming-of-age chaos with unmatched chemistry and genuine heart.",
        vibeTags: ["Hilarious", "Nostalgic"],
      },
      {
        title: "Booksmart",
        year: "2019",
        reason: "Fast-paced, modern, and razor-sharp buddy comedy for a late-night watch party.",
        vibeTags: ["Energetic", "Witty"],
      },
      {
        title: "Palm Springs",
        year: "2020",
        reason: "A wonderfully funny, existential time-loop rom-com with infectious energy.",
        vibeTags: ["Time-Loop", "Charming"],
      },
    ],
  },
];

const fallbackDefault = [
  {
    title: "Everything Everywhere All at Once",
    year: "2022",
    reason: "A multiverse riot of absurd comedy, stunning martial arts, and overwhelming emotional heart.",
    vibeTags: ["Multiverse", "Emotional"],
  },
  {
    title: "Blade Runner 2049",
    year: "2017",
    reason: "Immaculate neo-noir visuals and philosophical depth for a quiet, introspective evening.",
    vibeTags: ["Cyberpunk", "Philosophical"],
  },
  {
    title: "Knives Out",
    year: "2019",
    reason: "A supremely entertaining whodunit with an all-star cast and devilish twists.",
    vibeTags: ["Mystery", "Entertaining"],
  },
];

/**
 * Match a fallback query based on keywords
 */
function getFallbackRecs(query) {
  const lower = query.toLowerCase();
  for (const group of FALLBACK_VIBES) {
    if (group.keywords.some((k) => lower.includes(k))) {
      return group.recommendations;
    }
  }
  return fallbackDefault;
}

/**
 * Fetch rich movie data from TMDB for a given title
 */
export async function fetchTmdbMovieData(title, year) {
  try {
    const res = await axios.get(`${requests.searchMovies}${encodeURIComponent(title)}`);
    const results = res.data.results || [];
    if (results.length === 0) return null;

    // Filter to closest match or first movie with a poster
    const match =
      results.find((m) => {
        const itemYear = (m.release_date || m.first_air_date || "").substring(0, 4);
        return m.poster_path && (!year || itemYear === year);
      }) ||
      results.find((m) => m.poster_path) ||
      results[0];

    return match;
  } catch (error) {
    console.error("TMDB search error for", title, error);
    return null;
  }
}

/**
 * Main AI Recommendation function using Gemini API with intelligent fallback
 */
export async function getAiMovieRecommendations(prompt, history = []) {
  if (!GEMINI_API_KEY) {
    console.info("VITE_GEMINI_API_KEY not configured. Using intelligent vibe matching engine.");
    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 900));
    const recs = getFallbackRecs(prompt);

    // Fetch TMDB rich data in parallel
    const enriched = await Promise.all(
      recs.map(async (rec) => {
        const tmdbData = await fetchTmdbMovieData(rec.title, rec.year);
        return {
          ...rec,
          tmdb: tmdbData,
        };
      })
    );

    return {
      message: `Here are movies handpicked for: "${prompt}"`,
      movies: enriched,
    };
  }

  // Construct Gemini request with context
  const systemInstruction = `You are CineSync AI, an expert cinematic curator. 
The user will describe their mood, vibe, or criteria.
Recommend 3 to 4 distinct movies that fit their vibe.
Always return ONLY a valid JSON object matching this schema:
{
  "message": "A friendly 1-2 sentence response explaining the curation theme.",
  "recommendations": [
    {
      "title": "Exact Movie Title",
      "year": "YYYY",
      "reason": "Punchy 1-sentence reason why this matches their exact vibe.",
      "vibeTags": ["Tag1", "Tag2"]
    }
  ]
}
Do not wrap in markdown quotes if possible, return raw parseable JSON.`;

  // Build conversational context
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `${systemInstruction}\n\nUser request: "${prompt}"\nPrevious context: ${JSON.stringify(
            history.slice(-4)
          )}`,
        },
      ],
    },
  ];

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Clean JSON response (strip markdown fences if present)
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    const recommendations = parsed.recommendations || [];

    // Enrich each recommended movie with TMDB poster, backdrop, rating
    const enriched = await Promise.all(
      recommendations.map(async (rec) => {
        const tmdbData = await fetchTmdbMovieData(rec.title, rec.year);
        return {
          ...rec,
          tmdb: tmdbData,
        };
      })
    );

    return {
      message: parsed.message || "Here are movie recommendations matching your vibe:",
      movies: enriched,
    };
  } catch (err) {
    console.error("Gemini call failed, falling back to local curation engine:", err);
    const recs = getFallbackRecs(prompt);
    const enriched = await Promise.all(
      recs.map(async (rec) => {
        const tmdbData = await fetchTmdbMovieData(rec.title, rec.year);
        return { ...rec, tmdb: tmdbData };
      })
    );
    return {
      message: `Here are great titles fitting your request: "${prompt}"`,
      movies: enriched,
    };
  }
}
