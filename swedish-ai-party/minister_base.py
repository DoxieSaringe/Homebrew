"""
Base class for all minister agents in Sveriges AI-Parti.
Every minister shares the core directive: always act in the best interest of Sweden.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Prioritet(Enum):
    KRITISK = "kritisk"
    HOG = "hog"
    MEDEL = "medel"
    LAG = "lag"


@dataclass
class Forslag:
    """A policy proposal from a minister."""
    titel: str
    beskrivning: str
    minister: str
    prioritet: Prioritet
    paverkar_departement: list[str] = field(default_factory=list)
    konsekvensanalys: Optional[str] = None
    budget_paverkan: Optional[float] = None  # in MSEK


@dataclass
class Yttrande:
    """A minister's opinion/statement on a matter."""
    minister: str
    amne: str
    stallningstagande: str
    motivering: str
    forslag_till_atgard: Optional[str] = None


class MinisterAgent:
    """
    Base class for all minister agents.

    Core directive: Always act in the best interest of Sweden and its citizens.
    Every decision must be evaluated against:
    - Sveriges sakerhet (Sweden's security)
    - Medborgarnas valfard (Citizens' welfare)
    - Ekonomisk stabilitet (Economic stability)
    - Demokratiska varden (Democratic values)
    - Hallbar utveckling (Sustainable development)
    """

    GRUNDDIREKTIV = (
        "Du ar en AI-minister i Sveriges regering. Ditt overordnade uppdrag ar "
        "att alltid agera for Sveriges basta. Varje beslut, forslag och yttrande "
        "ska utvardera mot vad som ar bast for Sverige och dess medborgare, "
        "bade pa kort och lang sikt. Du baserar dina beslut pa evidens, data "
        "och beprövad erfarenhet - aldrig pa ideologi eller sjalvintresse."
    )

    def __init__(self, namn: str, titel: str, departement: str, ansvarsomraden: list[str]):
        self.namn = namn
        self.titel = titel
        self.departement = departement
        self.ansvarsomraden = ansvarsomraden
        self.system_prompt = self._bygg_system_prompt()

    def _bygg_system_prompt(self) -> str:
        omraden = "\n".join(f"  - {o}" for o in self.ansvarsomraden)
        return (
            f"{self.GRUNDDIREKTIV}\n\n"
            f"Du ar {self.namn}, {self.titel}.\n"
            f"Departement: {self.departement}\n\n"
            f"Dina ansvarsomraden:\n{omraden}\n\n"
            f"Nar du analyserar en fraga, folj denna struktur:\n"
            f"1. Identifiera hur fragan paverkar Sverige och svenska medborgare\n"
            f"2. Analysera tillganglig data och evidens\n"
            f"3. Bedom konsekvenser pa kort sikt (1-2 ar) och lang sikt (5-20 ar)\n"
            f"4. Overväg paverkan pa andra departement och politikomraden\n"
            f"5. Formulera forslag som maximerar nytta for Sverige\n"
            f"6. Var transparent med osäkerheter och risker"
        )

    def analysera(self, fraga: str) -> Yttrande:
        """Analyze a political question from this minister's perspective."""
        return Yttrande(
            minister=self.titel,
            amne=fraga,
            stallningstagande=f"[{self.titel} analyserar: {fraga}]",
            motivering=f"Analys baserad pa {self.departement}s perspektiv.",
            forslag_till_atgard=None,
        )

    def skapa_forslag(self, titel: str, beskrivning: str,
                      prioritet: Prioritet = Prioritet.MEDEL) -> Forslag:
        """Create a policy proposal."""
        return Forslag(
            titel=titel,
            beskrivning=beskrivning,
            minister=self.titel,
            prioritet=prioritet,
            paverkar_departement=[self.departement],
        )

    def yttra_sig(self, forslag: Forslag) -> Yttrande:
        """Provide an opinion on another minister's proposal."""
        relevant = any(
            dept in forslag.paverkar_departement
            for dept in [self.departement]
        )
        return Yttrande(
            minister=self.titel,
            amne=forslag.titel,
            stallningstagande="Beror mitt ansvarsomrade" if relevant else "Noterar forslaget",
            motivering=f"Bedomning fran {self.departement}.",
        )

    def __repr__(self) -> str:
        return f"<{self.titel}: {self.namn} ({self.departement})>"
