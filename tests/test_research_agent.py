import sys
from unittest.mock import MagicMock

# Mock chromadb before importing ResearchAgent
mock_chromadb = MagicMock()
sys.modules["chromadb"] = mock_chromadb
sys.modules["chromadb.config"] = MagicMock()

from app.research_agent import ResearchAgent
import pytest

@pytest.fixture
def research_agent():
    return ResearchAgent()

def test_get_market_analysis_oversold(research_agent):
    research_agent.previous_rsi = 20.0
    analysis = research_agent.get_market_analysis("BTC", 60000.0, 25.0)
    assert "Condition: Oversold/Bullish" in analysis
    assert "Recommendation: Favorable entry conditions. V-Shape RSI confirmation detected. RAG memory indicates historical positive reversion from these levels." in analysis

def test_get_market_analysis_overbought(research_agent):
    analysis = research_agent.get_market_analysis("BTC", 60000.0, 75.0)
    assert "Condition: Overbought/Bearish" in analysis
    assert "Recommendation: Caution. Overbought conditions or bearish news detected. Consider taking profit." in analysis

def test_get_market_analysis_neutral(research_agent):
    analysis = research_agent.get_market_analysis("BTC", 60000.0, 50.0)
    assert "Condition: Neutral" in analysis
    assert "Recommendation: Hold. No clear directional bias from vector memory." in analysis

def test_get_market_analysis_macro_data(research_agent):
    analysis = research_agent.get_market_analysis("BTC", 60000.0, 50.0, dxy=104.5, sp500=5000.0)
    assert "Macro: DXY 104.50 | S&P500 5,000.00" in analysis

def test_get_market_analysis_bearish_news(research_agent):
    analysis = research_agent.get_market_analysis("BTC", 60000.0, 50.0, news="Bearish_News")
    assert "Sentiment Alert: Bearish_News news detected in pipeline." in analysis
    assert "Recommendation: Caution. Overbought conditions or bearish news detected. Consider taking profit." in analysis

def test_get_market_analysis_oversold_with_bearish_news(research_agent):
    analysis = research_agent.get_market_analysis("BTC", 60000.0, 25.0, news="Bearish_News")
    assert "Condition: Oversold/Bullish" in analysis
    assert "Recommendation: Caution. Overbought conditions or bearish news detected. Consider taking profit." in analysis
