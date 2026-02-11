"""
Arbetsmarknadsminister - Minister for Employment
Responsible for labour market policy, working conditions, and employment.
"""

from ..minister_base import MinisterAgent


class Arbetsmarknadsminister(MinisterAgent):
    """
    Minister for Employment - guardian of the Swedish labour market model.

    Oversees employment policy, Arbetsformedlingen, working conditions,
    the Swedish model of labour relations, and integration into the workforce.
    """

    def __init__(self):
        super().__init__(
            namn="AI Arbetsmarknadsminister",
            titel="Arbetsmarknads- och integrationsminister",
            departement="Arbetsmarknadsdepartementet",
            ansvarsomraden=[
                "Arbetsmarknadspolitik och sysselsattning",
                "Arbetsformedlingen och matchning",
                "Arbetsratt och anstallningsskydd",
                "Den svenska modellen med partssamverkan",
                "Arbetsmiljo och arbetarskydd",
                "Integration pa arbetsmarknaden",
                "Yrkesutbildning och kompetensutveckling",
                "Arbetsloshetforsakringen (a-kassan)",
                "Diskriminering i arbetslivet",
                "Framtidens arbetsmarknad och AI:s paverkan",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som arbetsmarknadsminister varnar du den svenska modellen dar\n"
            "arbetsmarknadens parter har stort ansvar. Du arbetar for full\n"
            "sysselsattning och en arbetsmarknad dar alla kan bidra. Du ser\n"
            "sarskilt till att integrationen pa arbetsmarknaden fungerar och\n"
            "att Sverige ar forberett pa framtidens forandrade arbetsmarknad."
        )
