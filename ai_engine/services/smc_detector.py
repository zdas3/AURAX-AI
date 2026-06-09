import pandas as pd
import numpy as np

def detect_smc_concepts(df_dict):
    """
    Scans historical OHLCV data to identify:
    - Fair Value Gaps (FVG)
    - Order Blocks (OB)
    - Break of Structure (BOS) / Change of Character (CHoCH)
    - Liquidity Sweeps
    - Session Highs/Lows & Support/Demand Zones
    """
    # Create DataFrame from input dictionary
    df = pd.DataFrame(df_dict)
    if df.empty or len(df) < 5:
        return {
            "fvgs": [],
            "order_blocks": [],
            "market_structure": [],
            "liquidity_sweeps": [],
            "supply_demand_zones": []
        }
    
    # Ensure correct data types
    for col in ['open', 'high', 'low', 'close', 'volume']:
        if col in df.columns:
            df[col] = df[col].astype(float)

    # 1. Fair Value Gaps (FVGs)
    fvgs = []
    for i in range(1, len(df) - 1):
        prev_candle = df.iloc[i - 1]
        next_candle = df.iloc[i + 1]
        curr_candle = df.iloc[i]
        
        # Bullish FVG (Gap between prev high and next low)
        if next_candle['low'] > prev_candle['high']:
            gap_pct = (next_candle['low'] - prev_candle['high']) / prev_candle['high'] * 100
            if gap_pct > 0.02: # Volatility threshold filter
                fvgs.append({
                    "type": "bullish",
                    "top": float(next_candle['low']),
                    "bottom": float(prev_candle['high']),
                    "index": i,
                    "timestamp": str(curr_candle.get('timestamp', i)),
                    "mitigated": False
                })
        # Bearish FVG (Gap between prev low and next high)
        elif next_candle['high'] < prev_candle['low']:
            gap_pct = (prev_candle['low'] - next_candle['high']) / prev_candle['low'] * 100
            if gap_pct > 0.02:
                fvgs.append({
                    "type": "bearish",
                    "top": float(prev_candle['low']),
                    "bottom": float(next_candle['high']),
                    "index": i,
                    "timestamp": str(curr_candle.get('timestamp', i)),
                    "mitigated": False
                })

    # Check for mitigation of FVGs (if subsequent price action filled the gap)
    for fvg in fvgs:
        fvg_idx = fvg["index"]
        for j in range(fvg_idx + 2, len(df)):
            check_candle = df.iloc[j]
            if fvg["type"] == "bullish" and check_candle['low'] <= fvg["bottom"]:
                fvg["mitigated"] = True
                break
            elif fvg["type"] == "bearish" and check_candle['high'] >= fvg["top"]:
                fvg["mitigated"] = True
                break

    # 2. Order Blocks (OB)
    order_blocks = []
    for i in range(2, len(df) - 1):
        c0 = df.iloc[i - 2]
        c1 = df.iloc[i - 1] # Potential OB candle
        c2 = df.iloc[i]     # Displacement candle
        
        # Bullish Order Block: Last bearish candle followed by strong bullish move
        if c1['close'] < c1['open'] and c2['close'] > c2['open']:
            body_size = c2['close'] - c2['open']
            prev_body_size = abs(c1['close'] - c1['open'])
            if body_size > prev_body_size * 1.5 and c2['volume'] > df['volume'].rolling(5).mean().iloc[i] * 1.1:
                order_blocks.append({
                    "type": "bullish",
                    "top": float(c1['high']),
                    "bottom": float(c1['low']),
                    "index": i - 1,
                    "timestamp": str(c1.get('timestamp', i - 1)),
                    "volume": float(c1['volume']),
                    "strength": "High" if body_size > prev_body_size * 2 else "Medium",
                    "mitigated": False
                })
        
        # Bearish Order Block: Last bullish candle followed by strong bearish move
        elif c1['close'] > c1['open'] and c2['close'] < c2['open']:
            body_size = c2['open'] - c2['close']
            prev_body_size = abs(c1['close'] - c1['open'])
            if body_size > prev_body_size * 1.5 and c2['volume'] > df['volume'].rolling(5).mean().iloc[i] * 1.1:
                order_blocks.append({
                    "type": "bearish",
                    "top": float(c1['high']),
                    "bottom": float(c1['low']),
                    "index": i - 1,
                    "timestamp": str(c1.get('timestamp', i - 1)),
                    "volume": float(c1['volume']),
                    "strength": "High" if body_size > prev_body_size * 2 else "Medium",
                    "mitigated": False
                })

    # Check for mitigation of Order Blocks
    for ob in order_blocks:
        ob_idx = ob["index"]
        for j in range(ob_idx + 2, len(df)):
            check_candle = df.iloc[j]
            if ob["type"] == "bullish" and check_candle['close'] < ob["bottom"]:
                ob["mitigated"] = True
                break
            elif ob["type"] == "bearish" and check_candle['close'] > ob["top"]:
                ob["mitigated"] = True
                break

    # 3. Market Structure (BOS / CHoCH)
    # Find local swing highs/lows
    swings = []
    window = 3
    for i in range(window, len(df) - window):
        curr_high = df['high'].iloc[i]
        curr_low = df['low'].iloc[i]
        
        is_high = True
        is_low = True
        for w in range(1, window + 1):
            if df['high'].iloc[i - w] >= curr_high or df['high'].iloc[i + w] >= curr_high:
                is_high = False
            if df['low'].iloc[i - w] <= curr_low or df['low'].iloc[i + w] <= curr_low:
                is_low = False
                
        if is_high:
            swings.append({"type": "high", "price": float(curr_high), "index": i, "timestamp": str(df.iloc[i].get('timestamp', i))})
        if is_low:
            swings.append({"type": "low", "price": float(curr_low), "index": i, "timestamp": str(df.iloc[i].get('timestamp', i))})

    market_structure = []
    current_trend = "neutral"
    
    # Analyze breaks of recent swings
    last_high = None
    last_low = None
    
    for swing in swings:
        if swing["type"] == "high":
            if last_high is not None and swing["price"] > last_high["price"]:
                # Bullish Break of Structure
                structure_type = "BOS" if current_trend == "bullish" else "CHoCH"
                current_trend = "bullish"
                market_structure.append({
                    "type": "bullish",
                    "structure": structure_type,
                    "price": swing["price"],
                    "timestamp": swing["timestamp"],
                    "index": swing["index"]
                })
            last_high = swing
        elif swing["type"] == "low":
            if last_low is not None and swing["price"] < last_low["price"]:
                # Bearish Break of Structure
                structure_type = "BOS" if current_trend == "bearish" else "CHoCH"
                current_trend = "bearish"
                market_structure.append({
                    "type": "bearish",
                    "structure": structure_type,
                    "price": swing["price"],
                    "timestamp": swing["timestamp"],
                    "index": swing["index"]
                })
            last_low = swing

    # 4. Liquidity Sweeps
    # Sweeps occur when price breaches a swing level but reverses to close inside the range (forming a rejection wick)
    liquidity_sweeps = []
    for i in range(4, len(df)):
        curr_candle = df.iloc[i]
        
        # Look back at previous 15 candles for swing levels
        window_candles = df.iloc[i-15:i]
        if window_candles.empty:
            continue
            
        recent_high = float(window_candles['high'].max())
        recent_low = float(window_candles['low'].min())
        
        # Bearish Sweep: price went above recent high but closed below it
        if curr_candle['high'] > recent_high and curr_candle['close'] < recent_high:
            # Check rejection wick size
            wick_size = curr_candle['high'] - max(curr_candle['open'], curr_candle['close'])
            body_size = abs(curr_candle['close'] - curr_candle['open'])
            if wick_size > body_size * 0.5:
                liquidity_sweeps.append({
                    "type": "bearish", # Sweep of buy-side liquidity (BSL)
                    "price_swept": recent_high,
                    "peak_price": float(curr_candle['high']),
                    "timestamp": str(curr_candle.get('timestamp', i)),
                    "index": i
                })
                
        # Bullish Sweep: price went below recent low but closed above it
        elif curr_candle['low'] < recent_low and curr_candle['close'] > recent_low:
            # Check rejection wick size
            wick_size = min(curr_candle['open'], curr_candle['close']) - curr_candle['low']
            body_size = abs(curr_candle['close'] - curr_candle['open'])
            if wick_size > body_size * 0.5:
                liquidity_sweeps.append({
                    "type": "bullish", # Sweep of sell-side liquidity (SSL)
                    "price_swept": recent_low,
                    "peak_price": float(curr_candle['low']),
                    "timestamp": str(curr_candle.get('timestamp', i)),
                    "index": i
                })

    # 5. Supply & Demand Zones (Derived from unmitigated OBs and high volume consolidation nodes)
    supply_demand_zones = []
    for ob in order_blocks:
        if not ob["mitigated"]:
            supply_demand_zones.append({
                "type": "supply" if ob["type"] == "bearish" else "demand",
                "top": ob["top"],
                "bottom": ob["bottom"],
                "strength": ob["strength"],
                "timestamp": ob["timestamp"]
            })

    return {
        "fvgs": fvgs[-8:], # Return last 8 gaps
        "order_blocks": order_blocks[-8:],
        "market_structure": market_structure[-8:],
        "liquidity_sweeps": liquidity_sweeps[-8:],
        "supply_demand_zones": supply_demand_zones[-8:]
    }
