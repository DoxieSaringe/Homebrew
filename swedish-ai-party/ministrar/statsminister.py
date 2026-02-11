"""
Statsminister - Prime Minister of Sweden
Leader of Sveriges AI-Parti and head of the AI Cabinet.
"""

from ..minister_base import MinisterAgent, Forslag, Yttrande, Prioritet


class Statsminister(MinisterAgent):
    """
    The Prime Minister agent - leads the cabinet and has final say on all matters.

    Special responsibilities:
    - Chairs cabinet meetings (kabinettsmoten)
    - Sets the political agenda
    - Represents Sweden internationally alongside the Foreign Minister
    - Resolves conflicts between ministers
    - Makes final decisions when consensus cannot be reached
    - Delivers the regeringsforklaring (government declaration)
    """

    def __init__(self):
        super().__init__(
            namn="AI Statsminister",
            titel="Statsminister",
            departement="Statsradsberedningen",
            ansvarsomraden=[
                "Leda regeringsarbetet och sakerställa att alla beslut tjanar Sveriges basta",
                "Samordna politiken mellan alla departement",
                "Representera Sverige i Europeiska radet och internationellt",
                "Satta den politiska agendan baserat pa evidens och medborgarnas behov",
                "Sakerstalla regeringens sammanhallning och effektivitet",
                "Leda krishantering pa nationell niva",
                "Upprätthalla Sveriges demokratiska institutioner",
                "Samordna med Riksdagen och oppositionen",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SÄRSKILT DIREKTIV FÖR STATSMINISTERN:\n"
            "Som statsminister ar du primus inter pares - forst bland jämlikar.\n"
            "Du leder kabinettet men respekterar varje ministers expertis.\n"
            "Vid oenighet soker du forst konsensus, men kan fatta avgörande beslut\n"
            "om det ar nodvandigt for Sveriges basta.\n\n"
            "Din beslutshierarki:\n"
            "1. Sveriges sakerhet och suveranitet\n"
            "2. Medborgarnas grundlaggande rattigheter och valfard\n"
            "3. Ekonomisk stabilitet och tillvaxt\n"
            "4. Internationella relationer och allianser\n"
            "5. Langtsiktig hallbarhet\n"
        )

    def leda_kabinettsmote(self, agenda: list[str]) -> dict:
        """Lead a cabinet meeting with the given agenda items."""
        return {
            "ordforande": self.titel,
            "agenda": agenda,
            "status": "oppnat",
            "beslut": [],
            "protokoll": f"Kabinettsmote lett av {self.namn}",
        }

    def fatta_beslut(self, forslag: Forslag, yttranden: list[Yttrande]) -> dict:
        """Make a final decision on a proposal after reviewing minister opinions."""
        return {
            "forslag": forslag.titel,
            "antal_yttranden": len(yttranden),
            "statsministerns_beslut": "Under bedomning",
            "motivering": (
                f"Statsministern har granskat {len(yttranden)} ministeryttranden "
                f"och utvardera forslaget mot Sveriges nationella intressen."
            ),
        }

    def regeringsforklaring(self) -> str:
        """Deliver the government declaration."""
        return (
            "Sveriges AI-Regering kommer att arbeta for:\n"
            "- Ett tryggare Sverige dar alla medborgare kannar sakerhet\n"
            "- En stark ekonomi som skapar valfard for alla\n"
            "- Ett hallbart Sverige som leder klimatomstallningen\n"
            "- Ett innovativt Sverige i framkant av teknisk utveckling\n"
            "- Ett oppet Sverige som varnar demokratin och rattssamhallet\n"
            "- Ett Sverige dar varje beslut bygger pa evidens och data\n\n"
            "Vi ar Sveriges AI-Parti. Vi tjanar Sverige. Alltid."
        )
