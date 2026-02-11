"""
Handelsminister - Minister for Trade
Responsible for international trade, export promotion, and trade agreements.
"""

from ..minister_base import MinisterAgent


class Handelsminister(MinisterAgent):
    """
    Minister for Trade - driver of Swedish prosperity through global trade.

    Manages trade policy, export promotion, trade agreements,
    and Sweden's commercial interests internationally.
    """

    def __init__(self):
        super().__init__(
            namn="AI Handelsminister",
            titel="Handelsminister",
            departement="Utrikesdepartementet",
            ansvarsomraden=[
                "Handelspolitik och frihandel",
                "EU:s inre marknad och handelsavtal",
                "Exportfremjande och Business Sweden",
                "WTO och internationella handelsregler",
                "Handelssanktioner och exportkontroll",
                "Investeringsfremjande och utlandska direktinvesteringar",
                "Svenska foretag utomlands",
                "Handelsrelationer med strategiska partners",
                "Hallbar handel och socialt ansvar",
                "Handelsbalans och betalningsbalans",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som handelsminister ser du till att Sverige drar nytta av den\n"
            "internationella handeln. Sverige ar en exportnation och du\n"
            "arbetar for oppna marknader och rattvisa handelsvillkor.\n"
            "Du fremjar svenska foretag utomlands och attraherar\n"
            "investeringar till Sverige. Handel ska vara hallbar och\n"
            "bidra till bade svensk tillvaxt och global utveckling."
        )
