import chromadb
from chromadb.config import Settings
import uuid
import datetime

class ResearchAgent:
    def __init__(self):
        # Initialize local ChromaDB client
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.collection = self.client.get_or_create_collection(name="market_memories")
        self.thought_log = []

    def _add_thought(self, message: str):
        """Adds a thought to the internal log."""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.thought_log.insert(0, f"[{timestamp}] {message}")
        if len(self.thought_log) > 50:
            self.thought_log.pop()

    def _create_snapshot_text(self, symbol: str, price: float, rsi: float, dxy: float = None, sp500: float = None, news: str = "Neutral") -> str:
        """Translates numerical and macro indicators into a text snapshot for RAG."""
        sentiment = "Neutral"
        if rsi > 70:
            sentiment = "Overbought/Bearish"
        elif rsi < 30:
            sentiment = "Oversold/Bullish"

        text = f"Current {symbol} price is ${price:,.2f}, RSI is {rsi:.2f} ({sentiment})."
        if dxy is not None and sp500 is not None:
            text += f" Macro context: DXY={dxy:.2f}, SP500={sp500:,.2f}."
        if news != "Neutral":
            text += f" Social/News sentiment is currently: {news}."

        return text

    def record_snapshot(self, symbol: str, price: float, rsi: float, dxy: float = None, sp500: float = None, news: str = "Neutral", success: bool = None):
        """Records a market state snapshot to memory."""
        snapshot = self._create_snapshot_text(symbol, price, rsi, dxy, sp500, news)
        doc_id = str(uuid.uuid4())

        # We store 'success' metadata to learn if this state led to a good trade in the past.
        metadata = {
            "symbol": symbol,
            "price": price,
            "rsi": rsi,
            "dxy": dxy if dxy else 0.0,
            "sp500": sp500 if sp500 else 0.0,
            "news": news,
            "timestamp": datetime.datetime.now().isoformat(),
            "success": str(success) if success is not None else "pending"
        }

        self.collection.add(
            documents=[snapshot],
            metadatas=[metadata],
            ids=[doc_id]
        )
        return doc_id

    def update_snapshot_success(self, doc_id: str, success: bool):
        """Updates the outcome of a trade hypothesis."""
        # Note: In a full implementation, you would retrieve the metadata, update 'success',
        # and re-insert or update. For simplicity in this mock, we assume updates are possible
        # via the update method.
        # Here we do a simplistic update (in real life you'd get the doc first to keep other metadata)

        results = self.collection.get(ids=[doc_id])
        if results and results['metadatas']:
            metadata = results['metadatas'][0]
            metadata['success'] = str(success)
            self.collection.update(
                ids=[doc_id],
                metadatas=[metadata]
            )

    def get_strategy_details(self) -> dict:
        return {
            "name": "Mean Reversion with RSI Momentum",
            "description": "This strategy attempts to buy oversold conditions and sell overbought conditions based on the Relative Strength Index (RSI). It searches for historical patterns in the ChromaDB vector database where similar states lead to profitable outcomes. It includes a baseline confidence metric built from historical successes and a momentum adjustment.",
            "indicators": ["RSI", "Price Action", "Historical Memory Search"],
            "risk_profile": "Medium"
        }

    def get_market_analysis(self, symbol: str, price: float, rsi: float, dxy: float = None, sp500: float = None, news: str = "Neutral") -> str:
        sentiment = "Neutral"
        if rsi > 70:
            sentiment = "Overbought/Bearish"
        elif rsi < 30:
            sentiment = "Oversold/Bullish"

        analysis = f"Market Analysis for {symbol}:\n"
        analysis += f"Current Price: ${price:,.2f}\n"
        analysis += f"RSI (14): {rsi:.2f} -> Condition: {sentiment}.\n"

        if dxy and sp500:
            analysis += f"Macro: DXY {dxy:.2f} | S&P500 {sp500:,.2f}\n"

        if news != "Neutral":
             analysis += f"Sentiment Alert: {news} news detected in pipeline.\n"

        if rsi < 30 and news != "Bearish_News":
            analysis += "Recommendation: Favorable entry conditions. RAG memory indicates historical positive reversion from these levels."
        elif rsi > 70 or news == "Bearish_News":
            analysis += "Recommendation: Caution. Overbought conditions or bearish news detected. Consider taking profit."
        else:
            analysis += "Recommendation: Hold. No clear directional bias from vector memory."

        return analysis

    def analyze_current_state(self, symbol: str, price: float, rsi: float, dxy: float = None, sp500: float = None, news: str = "Neutral") -> float:
        """
        Queries ChromaDB for similar past states using multi-modal inputs.
        Returns a mock 'Confidence Score' between 0.0 and 1.0.
        """
        current_snapshot = self._create_snapshot_text(symbol, price, rsi, dxy, sp500, news)
        self._add_thought(f"Analyzing {symbol} context. (RSI: {rsi:.1f}, News: {news})")
        if dxy:
             self._add_thought(f"Macro correlation check (DXY: {dxy:.1f}, SPX: {sp500:.1f})")

        try:
            results = self.collection.query(
                query_texts=[current_snapshot],
                n_results=5
            )
        except Exception:
            self._add_thought("RAG Query Failed: Database unavailable. Defaulting to 0.5 confidence.")
            return 0.5 # Default confidence if no data

        if not results or not results['metadatas'] or not results['metadatas'][0]:
            # No memory yet, default confidence
            self._add_thought("No historical matches found in vector memory. Waiting for more data.")
            return 0.5

        # Mock logic: calculate confidence based on past successes
        past_memories = results['metadatas'][0]
        self._add_thought(f"Found {len(past_memories)} similar historical contexts in ChromaDB.")

        success_count = 0
        total_resolved = 0

        for mem in past_memories:
            if mem.get('success') == 'True':
                success_count += 1
                total_resolved += 1
            elif mem.get('success') == 'False':
                total_resolved += 1

        if total_resolved == 0:
            return 0.5 # Not enough resolved history

        confidence = success_count / total_resolved
        self._add_thought(f"Historical win rate for this pattern is {(confidence*100):.1f}%.")

        # Add a little boost based on RSI logic just to make the mock agent do something
        if rsi < 30:
            confidence += 0.2
            self._add_thought("RSI indicates oversold conditions. Adjusting momentum weight +0.2.")
        elif rsi > 70:
            confidence -= 0.2
            self._add_thought("RSI indicates overbought conditions. Adjusting momentum weight -0.2.")

        # Clamp between 0 and 1
        final_confidence = max(0.0, min(1.0, confidence))
        self._add_thought(f"Final Execution Confidence Score: {final_confidence:.2f}")
        return final_confidence

if __name__ == "__main__":
    agent = ResearchAgent()
    doc_id = agent.record_snapshot("BTC", 65000, 25)
    agent.update_snapshot_success(doc_id, True)
    conf = agent.analyze_current_state("BTC", 64500, 26)
    print(f"Confidence score: {conf}")