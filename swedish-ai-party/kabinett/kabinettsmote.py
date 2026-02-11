"""
Kabinettsmote - Cabinet Meeting System
Orchestrates discussions and decision-making between minister agents.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from ..minister_base import MinisterAgent, Forslag, Yttrande, Prioritet


class MoteStatus(Enum):
    PLANERAT = "planerat"
    PAGAENDE = "pagaende"
    AVSLUTAT = "avslutat"


@dataclass
class Agendapunkt:
    """An item on the cabinet meeting agenda."""
    titel: str
    beskrivning: str
    ansvarig_minister: str
    forslag: Optional[Forslag] = None
    yttranden: list[Yttrande] = field(default_factory=list)
    beslut: Optional[str] = None


@dataclass
class Protokoll:
    """Minutes from a cabinet meeting."""
    datum: str
    ordforande: str
    narvarande: list[str]
    agendapunkter: list[Agendapunkt]
    naesta_steg: list[str] = field(default_factory=list)


class Kabinettsmote:
    """
    Orchestrates a cabinet meeting between minister agents.

    The meeting follows the Swedish government tradition:
    1. Statsministern oppnar motet
    2. Agendapunkter behandlas i tur och ordning
    3. Berorda ministrar yttrar sig
    4. Diskussion och analys
    5. Statsministern sammanfattar och fattar beslut
    6. Protokoll fors

    Core principle: All discussions and decisions must serve
    Sweden's best interests.
    """

    def __init__(self, ministrar: list[MinisterAgent], statsminister: MinisterAgent):
        self.ministrar = ministrar
        self.statsminister = statsminister
        self.status = MoteStatus.PLANERAT
        self.agenda: list[Agendapunkt] = []
        self.protokoll: Optional[Protokoll] = None

    def lagg_till_agendapunkt(self, titel: str, beskrivning: str,
                               ansvarig_minister: str) -> Agendapunkt:
        """Add an agenda item to the meeting."""
        punkt = Agendapunkt(
            titel=titel,
            beskrivning=beskrivning,
            ansvarig_minister=ansvarig_minister,
        )
        self.agenda.append(punkt)
        return punkt

    def oppna_mote(self) -> dict:
        """Open the cabinet meeting."""
        self.status = MoteStatus.PAGAENDE
        narvarande = [m.titel for m in self.ministrar] + [self.statsminister.titel]
        return {
            "status": "oppnat",
            "ordforande": self.statsminister.titel,
            "narvarande": narvarande,
            "antal_agendapunkter": len(self.agenda),
            "meddelande": (
                f"Kabinettsmote oppnat av {self.statsminister.namn}. "
                f"{len(narvarande)} ministrar narvarande. "
                f"{len(self.agenda)} agendapunkter att behandla."
            ),
        }

    def behandla_agendapunkt(self, punkt_index: int) -> Agendapunkt:
        """Process an agenda item - gather opinions from relevant ministers."""
        if punkt_index >= len(self.agenda):
            raise IndexError(f"Agendapunkt {punkt_index} finns inte")

        punkt = self.agenda[punkt_index]

        # Each minister analyzes the agenda item
        for minister in self.ministrar:
            yttrande = minister.analysera(punkt.titel)
            punkt.yttranden.append(yttrande)

        return punkt

    def hitta_berorda_ministrar(self, fraga: str) -> list[MinisterAgent]:
        """Find ministers whose areas of responsibility are affected by a question."""
        berorda = []
        fraga_lower = fraga.lower()
        for minister in self.ministrar:
            for omrade in minister.ansvarsomraden:
                if any(ord in omrade.lower() for ord in fraga_lower.split()):
                    berorda.append(minister)
                    break
        return berorda

    def fatta_beslut(self, punkt_index: int, beslut: str) -> dict:
        """Record a decision on an agenda item."""
        punkt = self.agenda[punkt_index]
        punkt.beslut = beslut
        return {
            "agendapunkt": punkt.titel,
            "beslut": beslut,
            "antal_yttranden": len(punkt.yttranden),
            "beslutsfattare": self.statsminister.titel,
        }

    def avsluta_mote(self) -> Protokoll:
        """Close the meeting and generate minutes."""
        self.status = MoteStatus.AVSLUTAT

        narvarande = [m.titel for m in self.ministrar] + [self.statsminister.titel]
        naesta_steg = []

        for punkt in self.agenda:
            if punkt.beslut:
                naesta_steg.append(
                    f"{punkt.ansvarig_minister}: Verkstall beslut om '{punkt.titel}'"
                )

        self.protokoll = Protokoll(
            datum=datetime.now().strftime("%Y-%m-%d"),
            ordforande=self.statsminister.titel,
            narvarande=narvarande,
            agendapunkter=self.agenda,
            naesta_steg=naesta_steg,
        )

        return self.protokoll

    def sammanfattning(self) -> str:
        """Generate a summary of the meeting."""
        if not self.protokoll:
            return "Motet har inte avslutats an."

        beslutade = sum(1 for p in self.agenda if p.beslut)
        return (
            f"KABINETTSMOTE {self.protokoll.datum}\n"
            f"Ordforande: {self.protokoll.ordforande}\n"
            f"Narvarande: {len(self.protokoll.narvarande)} ministrar\n"
            f"Agendapunkter: {len(self.agenda)}\n"
            f"Beslut fattade: {beslutade}\n"
            f"Naesta steg: {len(self.protokoll.naesta_steg)} uppfoljningspunkter\n"
        )
