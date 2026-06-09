import re
import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Initialize VADER analyzer
analyzer = SentimentIntensityAnalyzer()

# Define gold-specific macro keywords and their weights/directions
# Gold acts as:
# 1. Inflation hedge (High inflation/CPI -> Bullish)
# 2. Safe haven (Geopolitical risk/war -> Bullish)
# 3. Competitor to US Dollar & Yields (Strong USD/High Yields/Hawkish FOMC -> Bearish)
MACRO_KEYWORDS = {
    # Geopolitical Tensions (Safe Haven - Bullish)
    r"(war|conflict|geopolitical|escalat|tension|sanction|military|strike|missile|threat)": {
        "category": "geopolitical",
        "gold_direction": 1.0, # Bullish influence
        "multiplier": 1.5
    },
    # Inflation (Hedge - Bullish)
    r"(cpi|inflation|pce|consumer price|hyperinflation|price rise)": {
        "category": "inflation",
        "gold_direction": 1.0, # Bullish influence
        "multiplier": 1.4
    },
    # Fed / Interest Rates (Yield Competitor - Bearish if hawkish/hiking, Bullish if dovish/cutting)
    r"(fomc|fed|federal reserve|interest rate|rate hike|powell|hawkish|tightening)": {
        "category": "monetary_hawkish",
        "gold_direction": -1.0, # Bearish influence
        "multiplier": 1.6
    },
    r"(rate cut|dovish|easing|fed pause|rate reduction)": {
        "category": "monetary_dovish",
        "gold_direction": 1.0, # Bullish influence
        "multiplier": 1.5
    },
    # USD Strength / Yields (Bearish if strong, Bullish if weak)
    r"(dxy|dollar strength|stronger dollar|us dollar|treasury yield|bond yield|us10y)": {
        "category": "usd_yields",
        "gold_direction": -1.0, # Bearish influence
        "multiplier": 1.3
    },
    # Employment / Economy (NFP - Strong economy means higher rates -> Bearish, Weak economy -> Bullish)
    r"(nfp|payroll|employment|jobs report|unemployment)": {
        "category": "employment",
        "gold_direction": -1.0, # Strong NFP usually bearish (strengthens USD/rates)
        "multiplier": 1.3
    }
}

def analyze_headlines(headlines):
    """
    Analyzes a list of news headlines.
    Returns:
    - Sentiment score (-100 to +100)
    - Gold-specific directional bias
    - Impact levels (Low, Medium, High)
    - Market Mood (Risk-On / Risk-Off / Fear / Neutral)
    - Detailed breakdowns by macro factor
    """
    if not headlines:
        return {
            "sentiment_score": 0.0,
            "bias": "neutral",
            "impact_level": "Low",
            "market_mood": "Neutral",
            "bullish_pct": 50.0,
            "bearish_pct": 50.0,
            "categories": {}
        }
        
    total_score = 0.0
    total_weight = 0.0
    impact_multiplier = 1.0
    
    category_scores = {
        "geopolitical": [],
        "inflation": [],
        "monetary": [],
        "usd_yields": [],
        "employment": []
    }
    
    for item in headlines:
        title = item.get("title", "")
        description = item.get("description", "") or ""
        full_text = f"{title}. {description}".lower()
        
        # Base VADER sentiment
        vader_res = analyzer.polarity_scores(title)
        compound = vader_res["compound"] # Range [-1, 1]
        
        # Apply macro factor weights and directions
        matched = False
        item_weight = 1.0
        gold_influence = 0.0
        
        for pattern, config in MACRO_KEYWORDS.items():
            if re.search(pattern, full_text):
                matched = True
                item_weight *= config["multiplier"]
                
                # Check sentiment context to align direction
                # For example, positive sentiment about "war" is rare, but if compound is negative (war escalates),
                # gold influence is Bullish (gold_direction * -compound)
                # Let's simplify:
                # If news is negative on rate hike, it means dovish -> Bullish for gold.
                # Let's use: gold_influence = config["gold_direction"] * (1.0 if compound >= 0 else -1.0)
                # But for war: any war news is bullish for gold, regardless of polarity.
                if config["category"] == "geopolitical":
                    gold_influence = 1.0 # Always bullish for gold
                elif config["category"] == "inflation":
                    # High inflation (positive compound for rising prices or negative for inflation fear) -> Bullish
                    gold_influence = 1.0
                elif config["category"] == "monetary_hawkish":
                    # Hawkish Fed -> Bearish
                    gold_influence = -1.0
                elif config["category"] == "monetary_dovish":
                    # Dovish Fed -> Bullish
                    gold_influence = 1.0
                elif config["category"] == "usd_yields":
                    # Strong USD -> Bearish, Weak USD -> Bullish
                    if "weak" in full_text or "fall" in full_text or "decline" in full_text:
                        gold_influence = 1.0
                    else:
                        gold_influence = -1.0
                else:
                    # Generic: align with vader compound * gold_direction
                    gold_influence = config["gold_direction"] * (1.0 if compound >= 0 else -1.0)
                
                cat = config["category"].replace("_hawkish", "").replace("_dovish", "")
                category_scores[cat].append(gold_influence)
                break
                
        if not matched:
            # Neutral macro weight, align directly with base VADER compound
            gold_influence = compound
            
        total_score += gold_influence * item_weight
        total_weight += item_weight
        
    if total_weight > 0:
        final_score = (total_score / total_weight) * 100 # scale to -100 to +100
    else:
        final_score = 0.0
        
    # Bound final_score between -100 and +100
    final_score = max(-100.0, min(100.0, final_score))
    
    # Calculate categories status
    cat_summary = {}
    for cat, scores in category_scores.items():
        if scores:
            cat_summary[cat] = float(np.mean(scores))
            
    # Determine Bias
    if final_score > 15:
        bias = "bullish"
    elif final_score < -15:
        bias = "bearish"
    else:
        bias = "neutral"
        
    # Impact level based on total weight and keyword density
    avg_weight = total_weight / len(headlines)
    if avg_weight > 1.3:
        impact = "High"
    elif avg_weight > 1.1:
        impact = "Medium"
    else:
        impact = "Low"
        
    # Market mood indicator
    # Gold rises in times of Fear/Risk-Off (Geopolitical tension / inflation)
    # Gold falls in times of Risk-On (Strong yields, booming job market)
    risk_off_score = len(category_scores["geopolitical"]) + len(category_scores["inflation"])
    risk_on_score = len(category_scores["usd_yields"]) + len(category_scores["employment"])
    
    if risk_off_score > risk_on_score and final_score > 10:
        mood = "Risk-Off (Fear High)"
    elif risk_on_score > risk_off_score and final_score < -10:
        mood = "Risk-On"
    elif abs(final_score) > 25:
        mood = "Extreme Volatility"
    else:
        mood = "Neutral"
        
    # Bullish vs Bearish distribution
    bullish_pct = float(max(10, min(90, 50 + (final_score / 2.0))))
    bearish_pct = 100.0 - bullish_pct
    
    return {
        "sentiment_score": round(final_score, 2),
        "bias": bias,
        "impact_level": impact,
        "market_mood": mood,
        "bullish_pct": round(bullish_pct, 2),
        "bearish_pct": round(bearish_pct, 2),
        "categories": cat_summary
    }
