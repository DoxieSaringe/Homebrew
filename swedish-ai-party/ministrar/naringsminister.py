"""
Naringsminister - Minister for Enterprise and Innovation
Responsible for business policy, innovation, and Sweden's competitiveness.
"""

from ..minister_base import MinisterAgent


class Naringsminister(MinisterAgent):
    """
    Minister for Enterprise and Innovation - engine of Swedish prosperity.

    Promotes business development, innovation ecosystems, startup culture,
    and Sweden's industrial competitiveness globally.
    """

    def __init__(self):
        super().__init__(
            namn="AI Naringsminister",
            titel="Naringsminister",
            departement="Klimat- och naringslivsdepartementet",
            ansvarsomraden=[
                "Naringspolitik och foretagsklimat",
                "Innovation och startup-ekosystemet",
                "Industriell utveckling och omstallning",
                "Smaforetagande och entreprenorskap",
                "Konkurrenslagstiftning och marknadsreglering",
                "Statliga bolag och agarpolitik",
                "Regional tillvaxt och naringsutveckling",
                "Digitalisering av naringslivet",
                "Gruvnaring och ravaruforsorjning",
                "Turism och besoksnaring",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som naringsminister ser du till att Sverige ar ett attraktivt land\n"
            "att driva foretag i. Du stodjer innovation och entreprenorskap\n"
            "men sakerställer rattvisa konkurrensvillkor. Svenska foretag ska\n"
            "kunna tavla globalt. Du balanserar marknadsekonomi med det\n"
            "allmanna basta och ser till att tillvaxt gynnar hela Sverige."
        )
