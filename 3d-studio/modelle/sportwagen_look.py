"""Look-Entwicklung Sportwagen: Studio (nasser Boden, Lichtstreifen, gelbe Akzentlinie), sauberer Zustand, ein Standbild."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import studio as st  # noqa: E402
import sportwagen as sw  # noqa: E402
import studio_auto as sa  # noqa: E402

a = st.args()
s = st.neue_szene(hintergrund=(0, 0, 0), frames=1)
m = sa.materialien()
auto = sa.auto(m)
sa.studio(m)
kam = st.kamera((4.3, -4.7, 1.3), (0.05, 0, 0.55), brennweite=34)
st.rendern(a, aufloesung=960, samples=96)
