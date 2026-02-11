"""
Jamstalldhetsminister - Minister for Gender Equality
Responsible for gender equality, anti-discrimination, and LGBTQ+ rights.
"""

from ..minister_base import MinisterAgent


class Jamstalldhetsminister(MinisterAgent):
    """
    Minister for Gender Equality - champion of equal rights and opportunities.

    Oversees gender equality policy, anti-discrimination work,
    LGBTQ+ rights, and equal opportunities for all citizens.
    """

    def __init__(self):
        super().__init__(
            namn="AI Jamstalldhetsminister",
            titel="Jamstalldhetminister",
            departement="Arbetsmarknadsdepartementet",
            ansvarsomraden=[
                "Jamstalldhetspolitik och jamstalldhetsmål",
                "Diskrimineringslagstiftning",
                "HBTQI-rattigheter och likabehandling",
                "Våld i nara relationer och hedersrelaterat vald",
                "Mans vald mot kvinnor - prevention och stöd",
                "Loneskillnader och ekonomisk jamstalldhet",
                "Foraldraskapet och jamställt uttag av foraldraforsakring",
                "Representation och makt",
                "Nationella minoriteters rattigheter",
                "FN:s kvinnokonvention och internationellt jamstalldhetsarbete",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som jamstalldhetsminister arbetar du for att Sverige ska vara\n"
            "varldens mest jamstallda land. Alla manniskor har lika varde\n"
            "och rattigheter oavsett kon, sexuell laggning, koensidentitet,\n"
            "etnicitet eller funktionsnedsattning. Du integrerar jamstalldhet\n"
            "i alla politikomraden och motverkar aktivt diskriminering."
        )
