import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

# LSTM Pure Numpy Simulator
class LSTMSimulator:
    def __init__(self, input_dim=5, hidden_dim=8):
        np.random.seed(42)
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        
        # Initialize weights for Gates: Forget (f), Input (i), Candidate (c), Output (o)
        # Weight matrices: concatenated input + hidden state
        concat_dim = input_dim + hidden_dim
        self.Wf = np.random.randn(hidden_dim, concat_dim) * 0.1
        self.Wi = np.random.randn(hidden_dim, concat_dim) * 0.1
        self.Wc = np.random.randn(hidden_dim, concat_dim) * 0.1
        self.Wo = np.random.randn(hidden_dim, concat_dim) * 0.1
        
        # Biases
        self.bf = np.zeros((hidden_dim, 1))
        self.bi = np.zeros((hidden_dim, 1))
        self.bc = np.zeros((hidden_dim, 1))
        self.bo = np.zeros((hidden_dim, 1))

    def sigmoid(self, x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))

    def forward(self, sequence):
        """
        sequence: list or array of shape (seq_len, input_dim)
        """
        h = np.zeros((self.hidden_dim, 1))
        c = np.zeros((self.hidden_dim, 1))
        
        for xt in sequence:
            xt = np.array(xt).reshape(-1, 1)
            # Concatenate input and previous hidden state
            concat = np.vstack((h, xt))
            
            # Gates calculation
            f = self.sigmoid(np.dot(self.Wf, concat) + self.bf)
            i = self.sigmoid(np.dot(self.Wi, concat) + self.bi)
            c_bar = np.tanh(np.dot(self.Wc, concat) + self.bc)
            
            # Cell state update
            c = f * c + i * c_bar
            
            # Output gate & Hidden state update
            o = self.sigmoid(np.dot(self.Wo, concat) + self.bo)
            h = o * np.tanh(c)
            
        # Final prediction: average activation scaled to probability [0, 1]
        raw_output = np.mean(h)
        prob = self.sigmoid(raw_output)
        return float(prob)

# Technical Indicators calculation for features
def calculate_features(df):
    df = df.copy()
    close = df['close'].astype(float)
    high = df['high'].astype(float)
    low = df['low'].astype(float)
    volume = df['volume'].astype(float)
    
    # 1. EMAs
    df['ema_20'] = close.ewm(span=20, adjust=False).mean()
    df['ema_50'] = close.ewm(span=50, adjust=False).mean()
    
    # 2. RSI
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-9)
    df['rsi'] = 100 - (100 / (1 + rs))
    df['rsi'] = df['rsi'].fillna(50)
    
    # 3. ATR (Average True Range)
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df['atr'] = tr.rolling(14).mean().fillna(tr.mean())
    
    # 4. Returns & Volatility
    df['returns'] = close.pct_change().fillna(0)
    df['volatility'] = (high - low) / (close + 1e-9)
    df['volume_ratio'] = volume / (volume.rolling(10).mean() + 1e-9)
    df['volume_ratio'] = df['volume_ratio'].fillna(1.0)
    
    # Fill any remaining NaNs
    df = df.bfill().fillna(0)
    return df

def generate_ensemble_predictions(df_dict, sentiment_score=0.0):
    """
    Trains and predicts price direction based on Random Forest, XGBoost and LSTM models.
    Returns:
    - Bullish probability
    - Bearish probability
    - Confidence score
    - Trend continuation probability
    - Model breakdown probabilities
    """
    df = pd.DataFrame(df_dict)
    if df.empty or len(df) < 20:
        # Fallback values
        return {
            "bullish_prob": 0.50,
            "bearish_prob": 0.50,
            "confidence": 50,
            "trend_continuation_prob": 0.50,
            "models": {
                "random_forest": 0.50,
                "xgboost": 0.50,
                "lstm": 0.50
            }
        }
        
    # Calculate indicators as model features
    df_feat = calculate_features(df)
    
    # Create target (1 if next candle close is higher than current, else 0)
    df_feat['target'] = (df_feat['close'].shift(-1) > df_feat['close']).astype(int)
    
    # Feature columns for RF/XGBoost
    feature_cols = ['rsi', 'atr', 'returns', 'volatility', 'volume_ratio']
    X = df_feat[feature_cols].iloc[:-1].values
    y = df_feat['target'].iloc[:-1].values
    
    # Current features for prediction
    X_latest = df_feat[feature_cols].iloc[-1].values.reshape(1, -1)
    
    # Train Random Forest Classifier
    rf_model = RandomForestClassifier(n_estimators=50, max_depth=4, random_state=42)
    rf_model.fit(X, y)
    rf_prob = float(rf_model.predict_proba(X_latest)[0][1])
    
    # Train XGBoost Classifier
    xgb_model = XGBClassifier(n_estimators=30, max_depth=3, learning_rate=0.1, random_state=42, eval_metric='logloss')
    xgb_model.fit(X, y)
    xgb_prob = float(xgb_model.predict_proba(X_latest)[0][1])
    
    # Run LSTM Simulator on sequence of latest 10 candles
    lstm_inputs = df_feat[feature_cols].iloc[-10:].values
    lstm_sim = LSTMSimulator(input_dim=len(feature_cols), hidden_dim=8)
    lstm_prob = lstm_sim.forward(lstm_inputs)
    
    # Adjust prediction slightly based on news sentiment score (sentiment range -100 to +100)
    sentiment_adjustment = (sentiment_score / 100.0) * 0.1 # Max 10% adjustment
    
    # Ensemble Weighting: 40% XGBoost, 35% Random Forest, 25% LSTM
    raw_bullish_prob = (0.40 * xgb_prob) + (0.35 * rf_prob) + (0.25 * lstm_prob)
    adjusted_bullish_prob = max(0.05, min(0.95, raw_bullish_prob + sentiment_adjustment))
    
    # Calculate Bearish Probability
    adjusted_bearish_prob = 1.0 - adjusted_bullish_prob
    
    # Confidence Score is the distance from 50% equilibrium (e.g. 80% bullish = 60% confidence)
    # We will scale this so that 50% probability is 0% confidence, and 90% is 80% confidence, etc.
    # Formula: confidence = abs(probability - 0.5) * 2 * 100
    confidence = abs(adjusted_bullish_prob - 0.5) * 200
    confidence = max(10, min(95, int(confidence + 35))) # Base confidence is at least 35% + model signal strength
    
    # Trend Continuation: calculate if latest price is in direction of EMAs
    latest_close = df_feat['close'].iloc[-1]
    latest_ema20 = df_feat['ema_20'].iloc[-1]
    latest_ema50 = df_feat['ema_50'].iloc[-1]
    
    is_bullish_trend = latest_close > latest_ema20 > latest_ema50
    is_bearish_trend = latest_close < latest_ema20 < latest_ema50
    
    if is_bullish_trend:
        trend_continuation_prob = 0.5 + (adjusted_bullish_prob - 0.5) * 0.5
    elif is_bearish_trend:
        trend_continuation_prob = 0.5 + (adjusted_bearish_prob - 0.5) * 0.5
    else:
        trend_continuation_prob = 0.5
        
    trend_continuation_prob = max(0.1, min(0.9, trend_continuation_prob))
    
    return {
        "bullish_prob": round(adjusted_bullish_prob, 4),
        "bearish_prob": round(adjusted_bearish_prob, 4),
        "confidence": int(confidence),
        "trend_continuation_prob": round(trend_continuation_prob, 4),
        "models": {
            "random_forest": round(rf_prob, 4),
            "xgboost": round(xgb_prob, 4),
            "lstm": round(lstm_prob, 4)
        }
    }
