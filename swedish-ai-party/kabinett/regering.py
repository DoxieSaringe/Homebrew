"""
AIRegeringen - The AI Government of Sweden
Assembles all minister agents into a functioning government.
"""

from ..ministrar import (
    Statsminister,
    Justitieminister,
    Utrikesminister,
    Forsvarsminister,
    Finansminister,
    Utbildningsminister,
    Socialminister,
    Miljominister,
    Naringsminister,
    Infrastrukturminister,
    Arbetsmarknadsminister,
    Kulturminister,
    Civilminister,
    Migrationsminister,
    Energiminister,
    Landsbygdsminister,
    Jamstalldhetsminister,
    Bistandsminister,
    Socialforsakringsminister,
    Skolminister,
    Aldreminister,
    Handelsminister,
    Sjukvardsminister,
)
from ..minister_base import MinisterAgent


class AIRegeringen:
    """
    The complete AI Government of Sweden.

    Contains all 23 minister agents plus the Prime Minister,
    organized by department and ready for cabinet meetings.

    Core principle: Every minister and every decision must serve
    the best interests of Sweden and its citizens.
    """

    def __init__(self):
        self.statsminister = Statsminister()
        self.ministrar: dict[str, MinisterAgent] = {}
        self._tillsatt_regering()

    def _tillsatt_regering(self):
        """Appoint all ministers to form the government."""
        minister_klasser = [
            Justitieminister,
            Utrikesminister,
            Forsvarsminister,
            Finansminister,
            Utbildningsminister,
            Socialminister,
            Miljominister,
            Naringsminister,
            Infrastrukturminister,
            Arbetsmarknadsminister,
            Kulturminister,
            Civilminister,
            Migrationsminister,
            Energiminister,
            Landsbygdsminister,
            Jamstalldhetsminister,
            Bistandsminister,
            Socialforsakringsminister,
            Skolminister,
            Aldreminister,
            Handelsminister,
            Sjukvardsminister,
        ]

        for klass in minister_klasser:
            minister = klass()
            self.ministrar[minister.titel] = minister

    def alla_ministrar(self) -> list[MinisterAgent]:
        """Return all ministers including the Prime Minister."""
        return [self.statsminister] + list(self.ministrar.values())

    def hitta_minister(self, nyckelord: str) -> list[MinisterAgent]:
        """Find ministers whose responsibilities match a keyword."""
        resultat = []
        nyckelord_lower = nyckelord.lower()
        for minister in self.alla_ministrar():
            for omrade in minister.ansvarsomraden:
                if nyckelord_lower in omrade.lower():
                    resultat.append(minister)
                    break
        return resultat

    def departement_oversikt(self) -> dict[str, list[str]]:
        """Get an overview of all departments and their ministers."""
        departement: dict[str, list[str]] = {}
        for minister in self.alla_ministrar():
            dept = minister.departement
            if dept not in departement:
                departement[dept] = []
            departement[dept].append(minister.titel)
        return departement

    def regeringsforklaring(self) -> str:
        """Get the government declaration from the Prime Minister."""
        return self.statsminister.regeringsforklaring()

    def antal_ministrar(self) -> int:
        """Total number of ministers including PM."""
        return len(self.ministrar) + 1  # +1 for statsminister

    def __repr__(self) -> str:
        return (
            f"<AIRegeringen: {self.antal_ministrar()} ministrar, "
            f"ledd av {self.statsminister.namn}>"
        )
