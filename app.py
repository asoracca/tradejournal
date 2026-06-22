from pathlib import Path
from datetime import date

import pandas as pd
import plotly.express as px
import streamlit as st
import yfinance as yf

DATA_DIR = Path("data")
TRADES_FILE = DATA_DIR / "trades.csv"

DATA_DIR.mkdir(exist_ok=True)

COLUMNS = [
    "date", "asset_class", "symbol", "direction", "strategy",
    "entry", "exit", "quantity", "multiplier", "pnl",
    "planned_stop", "target", "risk_per_trade", "thesis",
    "signal_source", "emotion", "rules_followed", "mistake",
    "lesson", "coach_comments", "flashcards_owed", "workout_owed"
]

FUTURES_MULTIPLIERS = {
    "MES": 5,
    "MNQ": 2,
    "MYM": 0.5,
    "M2K": 5,
    "MGC": 10,
    "MCL": 100,
}


def load_trades():
    if TRADES_FILE.exists():
        return pd.read_csv(TRADES_FILE)
    return pd.DataFrame(columns=COLUMNS)


def save_trade(row):
    df = load_trades()
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    df.to_csv(TRADES_FILE, index=False)


def get_live_price(symbol):
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1d")
        if hist.empty:
            return None
        return float(hist["Close"].iloc[-1])
    except Exception:
        return None


def coach_trade(row):
    comments = []

    if row["planned_stop"] <= 0:
        comments.append("No stop loss entered. Define invalidation before entering.")

    if row["target"] <= 0:
        comments.append("No target entered. Trade has no planned exit.")

    if row["risk_per_trade"] <= 0:
        comments.append("No planned risk entered. Position sizing cannot be judged.")

    if row["asset_class"] == "Futures Paper" and row["quantity"] > 1:
        comments.append("Beginner futures rule: paper trade 1 contract until consistent.")

    if row["asset_class"] == "Options Paper" and row["strategy"] == "Long Call/Put":
        comments.append("Long options need direction and timing. Track theta decay.")

    if row["asset_class"] == "Options Paper" and row["strategy"] == "Short Put":
        comments.append("Short puts carry assignment risk. Check worst-case loss.")

    if row["emotion"] in ["Revenge", "Greedy", "Bored"]:
        comments.append(f"Emotion flag: {row['emotion']}. This is a high-risk mental state.")

    if not row["rules_followed"]:
        comments.append("Rules were broken. Penalty assigned: flashcards + workout.")

    if row["pnl"] < 0 and row["rules_followed"]:
        comments.append("Good loss if rules were followed. Process over outcome.")

    if row["pnl"] > 0 and not row["rules_followed"]:
        comments.append("Bad win: profitable trade but poor process.")

    if not comments:
        comments.append("Trade looks process-complete. Review outcome later.")

    return " ".join(comments)


def calculate_pnl(asset_class, direction, entry, exit_price, quantity, multiplier):
    if entry <= 0 or exit_price <= 0:
        return 0.0
    pnl = (exit_price - entry) * quantity * multiplier
    if direction == "Short":
        pnl *= -1
    return pnl


st.set_page_config(page_title="TradeJournal", layout="wide")

st.title("TradeJournal")
st.caption("Paper trading journal and discipline coach for stocks, options, and futures.")

page = st.sidebar.radio(
    "Page",
    [
        "Dashboard",
        "Add Trade",
        "AI Coach",
        "Live Price Check",
        "Public Figure Comparison",
        "Discipline Penalties",
    ],
)

df = load_trades()

if page == "Dashboard":
    st.header("Dashboard")

    if df.empty:
        st.info("No trades yet. Add your first paper trade.")
    else:
        df["date"] = pd.to_datetime(df["date"])
        total_pnl = df["pnl"].sum()
        win_rate = (df["pnl"] > 0).mean()
        rule_score = df["rules_followed"].mean()
        avg_pnl = df["pnl"].mean()

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Trades", len(df))
        c2.metric("Total P&L", f"${total_pnl:,.2f}")
        c3.metric("Win Rate", f"{win_rate:.1%}")
        c4.metric("Rule Score", f"{rule_score:.1%}")

        st.metric("Average P&L / Trade", f"${avg_pnl:,.2f}")

        by_asset = df.groupby("asset_class", as_index=False)["pnl"].sum()
        fig = px.bar(by_asset, x="asset_class", y="pnl", title="P&L by Asset Class")
        st.plotly_chart(fig, use_container_width=True)

        equity = df.sort_values("date").copy()
        equity["cumulative_pnl"] = equity["pnl"].cumsum()
        fig2 = px.line(equity, x="date", y="cumulative_pnl", markers=True, title="Cumulative P&L")
        st.plotly_chart(fig2, use_container_width=True)

        st.subheader("Trade Log")
        st.dataframe(df, use_container_width=True)

elif page == "Add Trade":
    st.header("Add Trade")

    with st.form("trade_form"):
        trade_date = st.date_input("Date", value=date.today())
        asset_class = st.selectbox("Asset Class", ["Stock/ETF Paper", "Options Paper", "Futures Paper"])
        symbol = st.text_input("Symbol", placeholder="SOXL, QLD, MES, MNQ").upper()
        direction = st.selectbox("Direction", ["Long", "Short"])

        if asset_class == "Options Paper":
            strategy = st.selectbox("Strategy", ["Long Call/Put", "Short Put", "Short Call", "Spread", "Other"])
            multiplier = 100
        elif asset_class == "Futures Paper":
            strategy = st.selectbox("Strategy", ["Breakout", "Mean Reversion", "Trend Follow", "Scalp", "Other"])
            multiplier = FUTURES_MULTIPLIERS.get(symbol, 1)
            st.caption(f"Multiplier used: {multiplier}. Edit code later if contract differs.")
        else:
            strategy = st.selectbox("Strategy", ["Swing Trade", "Signal Trade", "Risk Rebalance", "Momentum", "Other"])
            multiplier = 1

        entry = st.number_input("Entry Price", min_value=0.0, step=0.01)
        exit_price = st.number_input("Exit Price", min_value=0.0, step=0.01)
        quantity = st.number_input("Quantity / Contracts", min_value=0.0, value=1.0, step=1.0)

        planned_stop = st.number_input("Planned Stop", min_value=0.0, step=0.01)
        target = st.number_input("Target", min_value=0.0, step=0.01)
        risk_per_trade = st.number_input("Planned $ Risk", min_value=0.0, step=1.0)

        signal_source = st.selectbox(
            "Signal Source",
            [
                "Discretionary",
                "SOXL Vol Surface",
                "New Space Radar",
                "Leveraged ETF Risk Lab",
                "Futures Paper Setup",
            ],
        )

        emotion = st.selectbox("Emotion", ["Calm", "Excited", "Fearful", "Greedy", "Revenge", "Bored"])
        rules_followed = st.checkbox("Rules followed?", value=True)

        thesis = st.text_area("Thesis / Reason")
        mistake = st.text_area("Mistake")
        lesson = st.text_area("Lesson")

        submitted = st.form_submit_button("Save Trade")

    if submitted:
        pnl = calculate_pnl(asset_class, direction, entry, exit_price, quantity, multiplier)

        row = {
            "date": trade_date,
            "asset_class": asset_class,
            "symbol": symbol,
            "direction": direction,
            "strategy": strategy,
            "entry": entry,
            "exit": exit_price,
            "quantity": quantity,
            "multiplier": multiplier,
            "pnl": pnl,
            "planned_stop": planned_stop,
            "target": target,
            "risk_per_trade": risk_per_trade,
            "thesis": thesis,
            "signal_source": signal_source,
            "emotion": emotion,
            "rules_followed": rules_followed,
            "mistake": mistake,
            "lesson": lesson,
        }

        row["coach_comments"] = coach_trade(row)
        row["flashcards_owed"] = 0 if rules_followed else 20
        row["workout_owed"] = "No" if rules_followed else "Yes"

        save_trade(row)

        st.success("Trade saved.")
        st.write("Coach:", row["coach_comments"])
        st.write(f"P&L: ${pnl:,.2f}")

elif page == "AI Coach":
    st.header("AI Coach")

    if df.empty:
        st.info("No trades to review yet.")
    else:
        latest = df.tail(10).copy()
        st.subheader("Latest Coach Comments")
        st.dataframe(latest[["date", "symbol", "asset_class", "pnl", "rules_followed", "coach_comments"]], use_container_width=True)

        broken = df[df["rules_followed"] == False]
        st.subheader("Rule Breaks")
        if broken.empty:
            st.success("No rule breaks logged.")
        else:
            st.dataframe(broken[["date", "symbol", "emotion", "mistake", "coach_comments"]], use_container_width=True)

elif page == "Live Price Check":
    st.header("Live Price Check")

    symbol = st.text_input("Symbol", placeholder="SOXL, QLD, RKLB, MES=F")
    if st.button("Get Price") and symbol:
        price = get_live_price(symbol.upper())
        if price is None:
            st.error("Could not fetch price. Try Yahoo format like MES=F for futures.")
        else:
            st.metric(symbol.upper(), f"${price:,.2f}")

    st.caption("For Yahoo futures symbols, examples include ES=F, NQ=F, MES=F, MNQ=F.")

elif page == "Public Figure Comparison":
    st.header("Public Figure Comparison")

    st.write(
        "Upload a CSV of public disclosure trades later. For now this page is a placeholder "
        "for comparing your trades against delayed public disclosures, not live copy trading."
    )

    uploaded = st.file_uploader("Upload disclosure CSV", type=["csv"])
    if uploaded:
        public_df = pd.read_csv(uploaded)
        st.dataframe(public_df, use_container_width=True)

        if not df.empty and "symbol" in public_df.columns:
            my_symbols = set(df["symbol"].dropna().str.upper())
            public_symbols = set(public_df["symbol"].dropna().str.upper())
            overlap = sorted(my_symbols.intersection(public_symbols))
            st.write("Overlapping symbols:", overlap)

elif page == "Discipline Penalties":
    st.header("Discipline Penalties")

    if df.empty:
        st.info("No trades yet.")
    else:
        flashcards = int(df["flashcards_owed"].sum())
        workouts = int((df["workout_owed"] == "Yes").sum())

        c1, c2 = st.columns(2)
        c1.metric("Flashcards Owed", flashcards)
        c2.metric("Workout Penalties", workouts)

        st.subheader("Penalty Trades")
        penalties = df[df["rules_followed"] == False]
        st.dataframe(penalties, use_container_width=True)
