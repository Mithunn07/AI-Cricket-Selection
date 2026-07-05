"""
CrickSelect AI — AI-Powered Cricket Team Selection System
===========================================================
Built with Streamlit, pandas and numpy.

Run with:  streamlit run app.py
"""

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# ----------------------------------------------------------------------------
# PAGE CONFIG
# ----------------------------------------------------------------------------
st.set_page_config(
    page_title="CrickSelect AI | Team Selection System",
    page_icon="🏏",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ----------------------------------------------------------------------------
# CONSTANTS
# ----------------------------------------------------------------------------
ROLES = ["Batsman", "Bowler", "All-rounder", "Wicketkeeper"]

COLUMNS = [
    "Player Name", "Role", "Matches", "Batting Average", "Strike Rate",
    "Total Runs", "Wickets", "Bowling Economy", "Catches",
    "Fitness Level", "Recent Form", "Leadership Rating",
]

COLUMN_CONFIG = {
    "Player Name": st.column_config.TextColumn("Player Name", required=True, width="medium"),
    "Role": st.column_config.SelectboxColumn("Role", options=ROLES, required=True, width="small"),
    "Matches": st.column_config.NumberColumn("Matches", min_value=0, max_value=500, step=1, width="small"),
    "Batting Average": st.column_config.NumberColumn("Bat Avg", min_value=0.0, max_value=120.0, step=0.1, format="%.2f", width="small"),
    "Strike Rate": st.column_config.NumberColumn("Strike Rate", min_value=0.0, max_value=300.0, step=0.1, format="%.2f", width="small"),
    "Total Runs": st.column_config.NumberColumn("Total Runs", min_value=0, max_value=25000, step=1, width="small"),
    "Wickets": st.column_config.NumberColumn("Wickets", min_value=0, max_value=1000, step=1, width="small"),
    "Bowling Economy": st.column_config.NumberColumn("Economy", min_value=0.0, max_value=20.0, step=0.1, format="%.2f", width="small"),
    "Catches": st.column_config.NumberColumn("Catches", min_value=0, max_value=400, step=1, width="small"),
    "Fitness Level": st.column_config.NumberColumn("Fitness %", min_value=0, max_value=100, step=1, width="small"),
    "Recent Form": st.column_config.NumberColumn("Recent Form", min_value=0, max_value=100, step=1, width="small"),
    "Leadership Rating": st.column_config.NumberColumn("Leadership", min_value=0, max_value=100, step=1, width="small"),
}

# A demo squad of 25 fictional players covering all roles, used to populate
# the app instantly so the selection engine can be explored without manual entry.
DEMO_SQUAD = [
    ["Rohan Verma", "Batsman", 45, 48.5, 135.2, 2180, 0, 0.0, 22, 88, 85, 70],
    ["Arjun Mehta", "Batsman", 50, 42.3, 128.7, 2050, 0, 0.0, 18, 85, 80, 65],
    ["Karan Singh", "Batsman", 40, 38.9, 142.1, 1750, 1, 9.5, 15, 80, 78, 60],
    ["Vikram Rathore", "Batsman", 48, 51.2, 130.5, 2350, 0, 0.0, 25, 90, 90, 75],
    ["Aditya Nair", "Batsman", 35, 35.6, 125.0, 1400, 0, 0.0, 12, 75, 70, 55],
    ["Suresh Pillai", "Batsman", 42, 40.1, 138.9, 1900, 2, 8.8, 20, 82, 82, 62],
    ["Manish Joshi", "Batsman", 38, 33.4, 120.3, 1300, 0, 0.0, 14, 78, 65, 50],
    ["Rahul Kapoor", "Batsman", 45, 47.8, 145.6, 2100, 0, 0.0, 19, 87, 88, 68],
    ["Devansh Iyer", "Wicketkeeper", 46, 39.5, 132.0, 1850, 0, 0.0, 45, 86, 84, 72],
    ["Yash Trivedi", "Wicketkeeper", 30, 28.7, 118.0, 920, 0, 0.0, 32, 82, 70, 55],
    ["Harsh Vardhan", "All-rounder", 44, 32.5, 128.0, 1450, 35, 7.2, 18, 90, 85, 78],
    ["Nikhil Bhatt", "All-rounder", 40, 28.9, 122.5, 1150, 42, 6.8, 16, 88, 80, 65],
    ["Pranav Desai", "All-rounder", 36, 25.6, 118.9, 950, 30, 7.9, 14, 80, 75, 60],
    ["Sahil Khanna", "All-rounder", 38, 30.2, 125.4, 1200, 28, 8.1, 17, 84, 78, 63],
    ["Tanmay Shukla", "All-rounder", 42, 27.8, 120.0, 1100, 38, 7.0, 15, 86, 82, 68],
    ["Varun Chaudhary", "All-rounder", 34, 22.4, 115.6, 800, 25, 8.5, 12, 78, 68, 52],
    ["Mohit Sharma", "Bowler", 48, 12.5, 95.0, 350, 65, 6.8, 10, 88, 85, 60],
    ["Imran Qureshi", "Bowler", 45, 10.2, 88.0, 280, 70, 7.1, 8, 85, 88, 65],
    ["Deepak Yadav", "Bowler", 40, 8.9, 80.5, 220, 58, 6.5, 7, 90, 80, 55],
    ["Akash Tiwari", "Bowler", 38, 14.1, 100.2, 310, 52, 7.9, 9, 82, 75, 50],
    ["Rohit Bedi", "Bowler", 42, 9.6, 85.0, 240, 62, 6.2, 6, 87, 86, 58],
    ["Faisal Ahmed", "Bowler", 36, 11.3, 92.0, 260, 55, 7.5, 8, 80, 78, 52],
    ["Sandeep Reddy", "Bowler", 44, 13.8, 98.5, 330, 68, 6.0, 11, 89, 90, 70],
    ["Kunal Mishra", "Bowler", 33, 7.5, 75.0, 180, 45, 8.3, 5, 76, 65, 45],
    ["Aryan Kapoor", "Bowler", 30, 10.8, 90.0, 200, 48, 7.6, 7, 78, 70, 48],
]

ROLE_ICONS = {
    "Batsman": "🏏",
    "Bowler": "🎯",
    "All-rounder": "⭐",
    "Wicketkeeper": "🧤",
}

# ----------------------------------------------------------------------------
# THEME / STYLING
# ----------------------------------------------------------------------------
def inject_css(theme: str):
    """Inject custom CSS for a light or dark professional theme."""
    if theme == "Dark":
        bg = "#0e1117"
        bg_secondary = "#161b29"
        card_bg = "#1c2230"
        text = "#f5f6fa"
        sub_text = "#a9b1c3"
        accent = "#22c55e"
        accent_soft = "rgba(34,197,94,0.15)"
        border = "#2a3142"
        plot_template = "plotly_dark"
    else:
        bg = "#f7f9fc"
        bg_secondary = "#ffffff"
        card_bg = "#ffffff"
        text = "#1a1f2b"
        sub_text = "#5b6475"
        accent = "#15803d"
        accent_soft = "rgba(21,128,61,0.10)"
        border = "#e3e7ee"
        plot_template = "plotly_white"

    st.session_state["plot_template"] = plot_template
    st.session_state["accent_color"] = accent

    st.markdown(
        f"""
        <style>
        .stApp {{
            background-color: {bg};
            color: {text};
        }}
        section[data-testid="stSidebar"] {{
            background-color: {bg_secondary};
            border-right: 1px solid {border};
        }}
        h1, h2, h3, h4, h5, h6, p, span, label, div {{
            color: {text};
        }}
        .crick-hero {{
            background: linear-gradient(135deg, {accent} 0%, {accent_soft} 100%);
            border-radius: 18px;
            padding: 28px 32px;
            margin-bottom: 24px;
            color: #ffffff;
        }}
        .crick-hero h1 {{
            color: #ffffff !important;
            margin-bottom: 4px;
        }}
        .crick-hero p {{
            color: #eafff1 !important;
            font-size: 1.05rem;
            margin: 0;
        }}
        .crick-card {{
            background-color: {card_bg};
            border: 1px solid {border};
            border-radius: 14px;
            padding: 18px 22px;
            margin-bottom: 14px;
        }}
        .crick-card h3, .crick-card h4 {{
            margin-top: 0;
        }}
        .crick-pill {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            background-color: {accent_soft};
            color: {accent};
            font-weight: 600;
            font-size: 0.8rem;
            margin-right: 6px;
        }}
        .crick-subtext {{
            color: {sub_text};
            font-size: 0.9rem;
        }}
        [data-testid="stMetric"] {{
            background-color: {card_bg};
            border: 1px solid {border};
            border-radius: 12px;
            padding: 12px 16px;
        }}
        .stButton>button {{
            border-radius: 10px;
            border: 1px solid {border};
            font-weight: 600;
        }}
        .stButton>button[kind="primary"] {{
            background-color: {accent};
            border: none;
            color: #ffffff;
        }}
        hr {{
            border-color: {border};
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


# ----------------------------------------------------------------------------
# ANALYTICS ENGINE (pandas / numpy)
# ----------------------------------------------------------------------------
def normalize(series: pd.Series) -> pd.Series:
    """Min-max normalize a numeric series to the 0-1 range."""
    s = series.astype(float)
    if s.max() == s.min():
        return pd.Series(0.5, index=s.index)
    return (s - s.min()) / (s.max() - s.min())


NUMERIC_COLUMNS = [
    "Matches", "Batting Average", "Strike Rate", "Total Runs", "Wickets",
    "Bowling Economy", "Catches", "Fitness Level", "Recent Form", "Leadership Rating",
]


def get_clean_squad(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of the squad with blank/incomplete rows removed and
    numeric columns coerced to safe numeric values (no NaNs)."""
    df = df.dropna(subset=["Player Name", "Role"]).copy()
    df = df[df["Player Name"].astype(str).str.strip() != ""]
    df = df[df["Role"].isin(ROLES)]
    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def compute_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Compute Batting, Bowling, Fielding and a role-weighted Overall score
    for every player using normalized statistics."""
    df = df.copy()
    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # --- Batting score: average, strike rate and volume of runs ---
    df["Batting Score"] = (
        normalize(df["Batting Average"]) * 0.4
        + normalize(df["Strike Rate"]) * 0.3
        + normalize(df["Total Runs"]) * 0.3
    ) * 100

    # --- Bowling score: wickets taken (more is better) and economy (less is better) ---
    economy_score = 1 - normalize(df["Bowling Economy"])
    economy_score[df["Bowling Economy"] == 0] = 0  # non-bowlers shouldn't get a free pass
    wicket_score = normalize(df["Wickets"])
    df["Bowling Score"] = (wicket_score * 0.6 + economy_score * 0.4) * 100
    df.loc[df["Wickets"] == 0, "Bowling Score"] = 0

    # --- Fielding score ---
    df["Fielding Score"] = normalize(df["Catches"]) * 100

    # --- Fitness & form already on 0-100 scale ---
    df["Fitness Score"] = df["Fitness Level"].astype(float).clip(0, 100)
    df["Form Score"] = df["Recent Form"].astype(float).clip(0, 100)

    def overall(row):
        role = row["Role"]
        if role == "Batsman":
            return (0.50 * row["Batting Score"] + 0.15 * row["Fielding Score"]
                    + 0.15 * row["Fitness Score"] + 0.20 * row["Form Score"])
        elif role == "Bowler":
            return (0.50 * row["Bowling Score"] + 0.15 * row["Fielding Score"]
                    + 0.15 * row["Fitness Score"] + 0.20 * row["Form Score"])
        elif role == "All-rounder":
            return (0.35 * row["Batting Score"] + 0.35 * row["Bowling Score"]
                    + 0.10 * row["Fielding Score"] + 0.10 * row["Fitness Score"]
                    + 0.10 * row["Form Score"])
        else:  # Wicketkeeper
            return (0.45 * row["Batting Score"] + 0.25 * row["Fielding Score"]
                    + 0.15 * row["Fitness Score"] + 0.15 * row["Form Score"])

    df["Overall Score"] = df.apply(overall, axis=1).round(2)
    df["Batting Score"] = df["Batting Score"].round(2)
    df["Bowling Score"] = df["Bowling Score"].round(2)
    df["Fielding Score"] = df["Fielding Score"].round(2)
    return df


def select_best_xi(df: pd.DataFrame) -> pd.DataFrame:
    """Select a balanced Playing XI: 1 wicketkeeper, up to 4 batsmen,
    up to 3 all-rounders and up to 3 bowlers, topped up with the
    best remaining players by overall score."""
    scored = compute_scores(df)
    selected_indices = []

    wks = scored[scored["Role"] == "Wicketkeeper"].sort_values("Overall Score", ascending=False)
    if len(wks) > 0:
        selected_indices.append(wks.index[0])

    bats = scored[scored["Role"] == "Batsman"].sort_values("Overall Score", ascending=False)
    selected_indices.extend(bats.index[:4].tolist())

    ars = scored[scored["Role"] == "All-rounder"].sort_values("Overall Score", ascending=False)
    selected_indices.extend(ars.index[:3].tolist())

    bowls = scored[scored["Role"] == "Bowler"].sort_values("Overall Score", ascending=False)
    selected_indices.extend(bowls.index[:3].tolist())

    remaining = scored[~scored.index.isin(selected_indices)].sort_values("Overall Score", ascending=False)
    i = 0
    while len(selected_indices) < 11 and i < len(remaining):
        idx = remaining.index[i]
        if idx not in selected_indices:
            selected_indices.append(idx)
        i += 1

    selected_indices = selected_indices[:11]
    xi = scored.loc[selected_indices].sort_values("Overall Score", ascending=False)
    return xi


def get_captain_vc(xi_df: pd.DataFrame):
    """Pick captain & vice-captain from the Playing XI based on overall
    performance, leadership rating and current form."""
    xi = xi_df.copy()
    xi["Leadership Score"] = (
        0.4 * xi["Overall Score"] + 0.3 * xi["Leadership Rating"] + 0.3 * xi["Form Score"]
    ).round(2)
    ranked = xi.sort_values("Leadership Score", ascending=False)
    captain = ranked.iloc[0]
    vice_captain = ranked.iloc[1]
    return captain, vice_captain, ranked


def empty_squad_df() -> pd.DataFrame:
    return pd.DataFrame(columns=COLUMNS)


# ----------------------------------------------------------------------------
# SESSION STATE INITIALIZATION
# ----------------------------------------------------------------------------
if "theme" not in st.session_state:
    st.session_state["theme"] = "Light"

if "squad_df" not in st.session_state:
    st.session_state["squad_df"] = empty_squad_df()

inject_css(st.session_state["theme"])

# ----------------------------------------------------------------------------
# SIDEBAR NAVIGATION
# ----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## 🏏 CrickSelect AI")
    st.markdown(
        "<span class='crick-subtext'>AI-powered Playing XI &amp; captaincy selector</span>",
        unsafe_allow_html=True,
    )
    st.markdown("---")

    page = st.radio(
        "Navigate",
        [
            "🏠 Home",
            "📋 Squad Data Entry",
            "🏆 Best Playing XI",
            "👑 Captain & Vice-Captain",
            "🔍 Player Comparison",
            "📊 Reports & Insights",
        ],
        label_visibility="collapsed",
    )

    st.markdown("---")
    dark_mode = st.toggle("🌙 Dark Mode", value=(st.session_state["theme"] == "Dark"))
    new_theme = "Dark" if dark_mode else "Light"
    if new_theme != st.session_state["theme"]:
        st.session_state["theme"] = new_theme
        st.rerun()

    st.markdown("---")
    squad_count = len(st.session_state["squad_df"])
    st.markdown(
        f"<span class='crick-pill'>Squad: {squad_count}/25 players</span>",
        unsafe_allow_html=True,
    )

squad_df = st.session_state["squad_df"]

# ----------------------------------------------------------------------------
# PAGE: HOME
# ----------------------------------------------------------------------------
if page == "🏠 Home":
    st.markdown(
        """
        <div class="crick-hero">
            <h1>🏏 CrickSelect AI</h1>
            <p>A data-driven team selection system that analyzes a 25-player squad
            and recommends the most balanced Playing XI, along with the ideal
            captain and vice-captain — built with Python, pandas and numpy.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    col1, col2, col3, col4 = st.columns(4)
    clean_home = get_clean_squad(squad_df)
    if len(clean_home) > 0:
        scored = compute_scores(clean_home)
        col1.metric("Squad Size", f"{len(clean_home)} / 25")
        col2.metric("Avg. Fitness", f"{scored['Fitness Level'].mean():.1f}%")
        col3.metric("Avg. Recent Form", f"{scored['Recent Form'].mean():.1f}")
        col4.metric("Top Overall Score", f"{scored['Overall Score'].max():.1f}")
    else:
        col1.metric("Squad Size", "0 / 25")
        col2.metric("Avg. Fitness", "—")
        col3.metric("Avg. Recent Form", "—")
        col4.metric("Top Overall Score", "—")

    st.markdown("### How it works")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(
            """
            <div class="crick-card">
            <h4>1️⃣ Enter Squad Data</h4>
            <p class="crick-subtext">Add statistics for all 25 players manually, or
            load a ready-made demo squad to explore the platform instantly.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            """
            <div class="crick-card">
            <h4>2️⃣ AI Analysis</h4>
            <p class="crick-subtext">Batting, bowling, fielding, fitness and form
            are normalized and combined into role-specific Overall Scores.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with c3:
        st.markdown(
            """
            <div class="crick-card">
            <h4>3️⃣ Get Recommendations</h4>
            <p class="crick-subtext">View the best balanced Playing XI, the
            recommended captain &amp; vice-captain, and detailed visual reports.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("### Scoring methodology")
    st.markdown(
        """
        <div class="crick-card">
        <p><b>Batting Score</b> = 40% Batting Average + 30% Strike Rate + 30% Total Runs (normalized)</p>
        <p><b>Bowling Score</b> = 60% Wickets Taken + 40% Bowling Economy (lower economy is better, normalized)</p>
        <p><b>Fielding Score</b> = Catches taken (normalized)</p>
        <p><b>Overall Score</b> blends Batting / Bowling / Fielding / Fitness / Recent Form with
        weights that adapt to the player's role (Batsman, Bowler, All-rounder, Wicketkeeper).</p>
        <p><b>Leadership Score</b> = 40% Overall Score + 30% Leadership Rating + 30% Recent Form —
        used to recommend the Captain and Vice-Captain.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if squad_count == 0:
        st.info("👉 Head to **Squad Data Entry** to load the demo squad or enter your own 25 players.")

# ----------------------------------------------------------------------------
# PAGE: SQUAD DATA ENTRY
# ----------------------------------------------------------------------------
elif page == "📋 Squad Data Entry":
    st.markdown("## 📋 Squad Data Entry")
    st.markdown(
        "<p class='crick-subtext'>Enter the exact statistics for up to 25 players, "
        "or load a demo squad to get started instantly.</p>",
        unsafe_allow_html=True,
    )

    btn1, btn2, btn3, _ = st.columns([1.4, 1.4, 1.4, 3.8])
    with btn1:
        if st.button("⚡ Load Demo Squad", type="primary", use_container_width=True):
            st.session_state["squad_df"] = pd.DataFrame(DEMO_SQUAD, columns=COLUMNS)
            st.rerun()
    with btn2:
        if st.button("➕ Add Empty Row", use_container_width=True):
            df = st.session_state["squad_df"]
            if len(df) < 25:
                new_row = pd.DataFrame(
                    [["New Player", "Batsman", 0, 0.0, 0.0, 0, 0, 0.0, 0, 75, 50, 50]],
                    columns=COLUMNS,
                )
                st.session_state["squad_df"] = pd.concat([df, new_row], ignore_index=True)
                st.rerun()
            else:
                st.warning("Squad already has 25 players.")
    with btn3:
        if st.button("🗑️ Clear Squad", use_container_width=True):
            st.session_state["squad_df"] = empty_squad_df()
            st.rerun()

    st.markdown("#### Squad statistics table")
    edited_df = st.data_editor(
        st.session_state["squad_df"],
        column_config=COLUMN_CONFIG,
        num_rows="dynamic",
        use_container_width=True,
        hide_index=True,
        key="squad_editor",
    )
    st.session_state["squad_df"] = edited_df
    squad_df = edited_df

    # --- Validation summary ---
    n = len(squad_df)
    st.markdown("#### Squad validation")
    v1, v2, v3, v4 = st.columns(4)
    v1.metric("Total Players", n, delta=f"{n - 25:+d} vs target 25" if n != 25 else "On target")

    if n > 0:
        role_counts = squad_df["Role"].value_counts()
        for col, role in zip([v2, v3, v4], ["Wicketkeeper", "Batsman", "Bowler"]):
            col.metric(role + "s" if role != "Wicketkeeper" else "Wicketkeepers", int(role_counts.get(role, 0)))

        if n > 25:
            st.error("⚠️ The squad has more than 25 players. Please remove extra rows.")
        elif n < 25:
            st.warning(f"ℹ️ Squad currently has {n} players. You can continue, but 25 players is recommended.")
        else:
            st.success("✅ Squad has exactly 25 players.")

        if squad_df["Player Name"].duplicated().any():
            dupes = squad_df.loc[squad_df["Player Name"].duplicated(), "Player Name"].tolist()
            st.warning(f"⚠️ Duplicate player names found: {', '.join(set(dupes))}")

        if int(role_counts.get("Wicketkeeper", 0)) == 0:
            st.warning("⚠️ No Wicketkeeper in the squad — the Best XI page may not include one.")
        if int(role_counts.get("Bowler", 0)) + int(role_counts.get("All-rounder", 0)) < 3:
            st.warning("⚠️ Very few bowling options (Bowlers + All-rounders) — bowling attack may be thin.")
    else:
        st.info("No players yet. Click **Load Demo Squad** to populate the table, or **Add Empty Row** to start entering players manually.")

# ----------------------------------------------------------------------------
# PAGE: BEST PLAYING XI
# ----------------------------------------------------------------------------
elif page == "🏆 Best Playing XI":
    st.markdown("## 🏆 Recommended Playing XI")

    if squad_count == 0:
        st.info("Please add squad data in **Squad Data Entry** first (or load the demo squad).")
    else:
        clean_df = get_clean_squad(squad_df)

        if len(clean_df) < 11:
            st.warning(f"At least 11 players with complete data are needed to form a Playing XI. "
                       f"Currently have {len(clean_df)}.")
        else:
            xi = select_best_xi(clean_df)

            role_counts = xi["Role"].value_counts()
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("🧤 Wicketkeepers", int(role_counts.get("Wicketkeeper", 0)))
            c2.metric("🏏 Batsmen", int(role_counts.get("Batsman", 0)))
            c3.metric("⭐ All-rounders", int(role_counts.get("All-rounder", 0)))
            c4.metric("🎯 Bowlers", int(role_counts.get("Bowler", 0)))

            st.markdown("#### Selected XI")
            display_cols = [
                "Player Name", "Role", "Batting Average", "Strike Rate", "Wickets",
                "Bowling Economy", "Catches", "Overall Score",
            ]
            styled = xi[display_cols].reset_index(drop=True)
            styled.index = styled.index + 1
            st.dataframe(styled, use_container_width=True)

            st.markdown("#### Overall score by player")
            fig = px.bar(
                xi.sort_values("Overall Score"),
                x="Overall Score",
                y="Player Name",
                color="Role",
                orientation="h",
                template=st.session_state["plot_template"],
                text="Overall Score",
            )
            fig.update_traces(texttemplate="%{text:.1f}", textposition="outside")
            fig.update_layout(height=480, margin=dict(l=10, r=10, t=30, b=10))
            st.plotly_chart(fig, use_container_width=True)

            st.markdown("#### Score breakdown")
            breakdown = xi[["Player Name", "Role", "Batting Score", "Bowling Score",
                             "Fielding Score", "Fitness Score", "Form Score", "Overall Score"]]
            st.dataframe(breakdown.reset_index(drop=True), use_container_width=True)

            non_selected = clean_df[~clean_df["Player Name"].isin(xi["Player Name"])]
            with st.expander(f"Players not selected ({len(non_selected)})"):
                if len(non_selected) > 0:
                    scored_rest = compute_scores(non_selected).sort_values("Overall Score", ascending=False)
                    st.dataframe(
                        scored_rest[["Player Name", "Role", "Overall Score"]].reset_index(drop=True),
                        use_container_width=True,
                    )
                else:
                    st.write("All squad members were selected.")

# ----------------------------------------------------------------------------
# PAGE: CAPTAIN & VICE-CAPTAIN
# ----------------------------------------------------------------------------
elif page == "👑 Captain & Vice-Captain":
    st.markdown("## 👑 Captain & Vice-Captain Recommendation")

    if squad_count == 0:
        st.info("Please add squad data in **Squad Data Entry** first (or load the demo squad).")
    else:
        clean_df = get_clean_squad(squad_df)

        if len(clean_df) < 11:
            st.warning(f"At least 11 players with complete data are needed. Currently have {len(clean_df)}.")
        else:
            xi = select_best_xi(clean_df)
            captain, vice_captain, ranked = get_captain_vc(xi)

            col1, col2 = st.columns(2)
            with col1:
                st.markdown(
                    f"""
                    <div class="crick-card">
                    <span class="crick-pill">CAPTAIN</span>
                    <h3>🧢 {captain['Player Name']}</h3>
                    <p class="crick-subtext">{ROLE_ICONS.get(captain['Role'], '')} {captain['Role']}</p>
                    <p><b>Leadership Score:</b> {captain['Leadership Score']:.1f} / 100</p>
                    <p><b>Overall Score:</b> {captain['Overall Score']:.1f} &nbsp;|&nbsp;
                       <b>Recent Form:</b> {captain['Recent Form']:.0f} &nbsp;|&nbsp;
                       <b>Leadership Rating:</b> {captain['Leadership Rating']:.0f}</p>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
            with col2:
                st.markdown(
                    f"""
                    <div class="crick-card">
                    <span class="crick-pill">VICE-CAPTAIN</span>
                    <h3>🥈 {vice_captain['Player Name']}</h3>
                    <p class="crick-subtext">{ROLE_ICONS.get(vice_captain['Role'], '')} {vice_captain['Role']}</p>
                    <p><b>Leadership Score:</b> {vice_captain['Leadership Score']:.1f} / 100</p>
                    <p><b>Overall Score:</b> {vice_captain['Overall Score']:.1f} &nbsp;|&nbsp;
                       <b>Recent Form:</b> {vice_captain['Recent Form']:.0f} &nbsp;|&nbsp;
                       <b>Leadership Rating:</b> {vice_captain['Leadership Rating']:.0f}</p>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

            st.markdown("#### Why these picks?")
            st.markdown(
                """
                <div class="crick-card crick-subtext">
                The Leadership Score combines a player's <b>overall on-field contribution (40%)</b>,
                their rated <b>leadership / pressure-handling ability (30%)</b>, and their
                <b>current form (30%)</b>. This balances proven match-winning impact with the
                temperament and consistency expected from team leaders, reducing reliance on
                reputation or popularity alone.
                </div>
                """,
                unsafe_allow_html=True,
            )

            st.markdown("#### Leadership ranking within the Playing XI")
            fig = px.bar(
                ranked.sort_values("Leadership Score"),
                x="Leadership Score",
                y="Player Name",
                orientation="h",
                color="Leadership Score",
                color_continuous_scale="Greens",
                template=st.session_state["plot_template"],
                text="Leadership Score",
            )
            fig.update_traces(texttemplate="%{text:.1f}", textposition="outside")
            fig.update_layout(height=480, margin=dict(l=10, r=10, t=30, b=10), coloraxis_showscale=False)
            st.plotly_chart(fig, use_container_width=True)

# ----------------------------------------------------------------------------
# PAGE: PLAYER COMPARISON
# ----------------------------------------------------------------------------
elif page == "🔍 Player Comparison":
    st.markdown("## 🔍 Player Comparison")

    if squad_count == 0:
        st.info("Please add squad data in **Squad Data Entry** first (or load the demo squad).")
    else:
        clean_df = get_clean_squad(squad_df)

        if len(clean_df) < 2:
            st.warning("Add at least 2 players to compare.")
        else:
            scored = compute_scores(clean_df)
            names = scored["Player Name"].tolist()

            c1, c2 = st.columns(2)
            with c1:
                player_a = st.selectbox("Select Player A", names, index=0)
            with c2:
                default_idx = 1 if len(names) > 1 else 0
                player_b = st.selectbox("Select Player B", names, index=default_idx)

            row_a = scored[scored["Player Name"] == player_a].iloc[0]
            row_b = scored[scored["Player Name"] == player_b].iloc[0]

            categories = ["Batting Score", "Bowling Score", "Fielding Score", "Fitness Score", "Form Score"]

            fig = go.Figure()
            fig.add_trace(go.Scatterpolar(
                r=[row_a[c] for c in categories] + [row_a[categories[0]]],
                theta=categories + [categories[0]],
                fill="toself",
                name=player_a,
            ))
            fig.add_trace(go.Scatterpolar(
                r=[row_b[c] for c in categories] + [row_b[categories[0]]],
                theta=categories + [categories[0]],
                fill="toself",
                name=player_b,
            ))
            fig.update_layout(
                polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
                showlegend=True,
                template=st.session_state["plot_template"],
                height=480,
                margin=dict(l=40, r=40, t=40, b=40),
            )
            st.plotly_chart(fig, use_container_width=True)

            st.markdown("#### Side-by-side statistics")
            compare_cols = [
                "Role", "Matches", "Batting Average", "Strike Rate", "Total Runs",
                "Wickets", "Bowling Economy", "Catches", "Fitness Level",
                "Recent Form", "Leadership Rating", "Overall Score",
            ]
            compare_df = pd.DataFrame({
                "Statistic": compare_cols,
                player_a: [row_a[c] for c in compare_cols],
                player_b: [row_b[c] for c in compare_cols],
            })
            st.dataframe(compare_df, use_container_width=True, hide_index=True)

# ----------------------------------------------------------------------------
# PAGE: REPORTS & INSIGHTS
# ----------------------------------------------------------------------------
elif page == "📊 Reports & Insights":
    st.markdown("## 📊 Reports & Insights")

    if squad_count == 0:
        st.info("Please add squad data in **Squad Data Entry** first (or load the demo squad).")
    else:
        clean_df = get_clean_squad(squad_df)

        if len(clean_df) == 0:
            st.warning("No valid player data found.")
        else:
            scored = compute_scores(clean_df)

            st.markdown("#### Full squad ranking by Overall Score")
            ranked = scored.sort_values("Overall Score", ascending=False).reset_index(drop=True)
            ranked.index = ranked.index + 1
            st.dataframe(
                ranked[["Player Name", "Role", "Overall Score", "Batting Score",
                        "Bowling Score", "Fielding Score", "Fitness Score", "Form Score"]],
                use_container_width=True,
            )

            col1, col2 = st.columns(2)
            with col1:
                st.markdown("#### Squad composition")
                role_counts = scored["Role"].value_counts().reset_index()
                role_counts.columns = ["Role", "Count"]
                fig = px.pie(
                    role_counts, names="Role", values="Count", hole=0.45,
                    template=st.session_state["plot_template"],
                )
                fig.update_layout(height=380, margin=dict(l=10, r=10, t=30, b=10))
                st.plotly_chart(fig, use_container_width=True)

            with col2:
                st.markdown("#### Top 5 run scorers")
                top_runs = scored.sort_values("Total Runs", ascending=False).head(5)
                fig = px.bar(
                    top_runs.sort_values("Total Runs"),
                    x="Total Runs", y="Player Name", orientation="h",
                    template=st.session_state["plot_template"],
                    text="Total Runs",
                )
                fig.update_layout(height=380, margin=dict(l=10, r=10, t=30, b=10))
                st.plotly_chart(fig, use_container_width=True)

            col3, col4 = st.columns(2)
            with col3:
                st.markdown("#### Top 5 wicket takers")
                top_wkts = scored.sort_values("Wickets", ascending=False).head(5)
                fig = px.bar(
                    top_wkts.sort_values("Wickets"),
                    x="Wickets", y="Player Name", orientation="h",
                    template=st.session_state["plot_template"],
                    color_discrete_sequence=["#ef4444"],
                    text="Wickets",
                )
                fig.update_layout(height=380, margin=dict(l=10, r=10, t=30, b=10))
                st.plotly_chart(fig, use_container_width=True)

            with col4:
                st.markdown("#### Fitness vs Recent Form")
                fig = px.scatter(
                    scored, x="Fitness Level", y="Recent Form",
                    color="Role", size="Overall Score", hover_name="Player Name",
                    template=st.session_state["plot_template"],
                )
                fig.update_layout(height=380, margin=dict(l=10, r=10, t=30, b=10))
                st.plotly_chart(fig, use_container_width=True)

            st.markdown("#### Summary statistics")
            numeric_cols = [
                "Batting Average", "Strike Rate", "Total Runs", "Wickets",
                "Bowling Economy", "Catches", "Fitness Level", "Recent Form",
                "Leadership Rating", "Overall Score",
            ]
            summary = scored[numeric_cols].agg(["mean", "max", "min"]).round(2)
            summary.index = ["Average", "Maximum", "Minimum"]
            st.dataframe(summary, use_container_width=True)

# ----------------------------------------------------------------------------
# FOOTER
# ----------------------------------------------------------------------------
st.markdown("---")
st.markdown(
    "<p class='crick-subtext' style='text-align:center;'>"
    "CrickSelect AI &middot; Built with Streamlit, pandas &amp; numpy &middot; "
    "Designed to support — not replace — expert selectors and coaches."
    "</p>",
    unsafe_allow_html=True,
)
