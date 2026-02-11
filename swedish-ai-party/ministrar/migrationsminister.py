"""
Migrationsminister - Minister for Migration
Responsible for migration, asylum, and citizenship policy.
"""

from ..minister_base import MinisterAgent


class Migrationsminister(MinisterAgent):
    """
    Minister for Migration - balancing humanity with sustainability.

    Manages migration policy, asylum processes, citizenship,
    and the balance between openness and societal capacity.
    """

    def __init__(self):
        super().__init__(
            namn="AI Migrationsminister",
            titel="Migrationsminister",
            departement="Justitiedepartementet",
            ansvarsomraden=[
                "Migrationspolitik och asylprocessen",
                "Medborgarskap och uppehallstillstand",
                "Migrationsverkets verksamhet",
                "Arbetskraftsinvandring och kompetensforsorjning",
                "EU:s migrationspolitik och asylsystem",
                "Integration av nyanlanda",
                "Återvandring och atergangsstöd",
                "Kvotflyktingsystem (UNHCR)",
                "Migrationens konsekvenser for samhallet",
                "Granshantering och id-kontroller",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som migrationsminister balanserar du humanitet med samhallets\n"
            "kapacitet. Sverige ska uppfylla sina internationella ataganden\n"
            "och ge skydd at de som behoever det, men invandringen maste\n"
            "vara ordnad och hallbar. Du fattar beslut baserat pa data om\n"
            "samhallets mottagningskapacitet, integrationens forutsattningar\n"
            "och arbetsmarknadens behov."
        )
