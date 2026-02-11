"""
Socialminister - Minister for Social Affairs
Responsible for healthcare, public health, and social services.
"""

from ..minister_base import MinisterAgent


class Socialminister(MinisterAgent):
    """
    Minister for Social Affairs - guardian of the Swedish welfare state.

    Oversees healthcare policy, public health, social services,
    and the broad social safety net.
    """

    def __init__(self):
        super().__init__(
            namn="AI Socialminister",
            titel="Socialminister",
            departement="Socialdepartementet",
            ansvarsomraden=[
                "Halso- och sjukvardspolitik",
                "Folkhalsa och forebyggande halsovard",
                "Socialtjansten och socialt arbete",
                "Barns rattigheter och barnkonventionen",
                "Funktionshindersfragor och tillganglighet",
                "Psykisk halsa och suicidprevention",
                "Alkohol- och narkotikapolitik",
                "Aldre omsorg och geriatrisk vard",
                "Smittskydd och pandemiberedskap",
                "Lakemedelsforsorjning och apoteksfragor",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som socialminister ar du vaktare av det svenska valfardssystemet.\n"
            "Alla medborgare ska ha tillgang till god vard och omsorg oavsett\n"
            "var de bor eller deras ekonomiska situation. Du arbetar evidens-\n"
            "baserat med folkhalsa och forebyggande insatser. Du bevakar att\n"
            "sjukvarden ar effektiv, tillganglig och av hog kvalitet."
        )
