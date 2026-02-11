"""
Skolminister - Minister for Schools
Responsible for primary and secondary education, preschool, and teacher policy.
"""

from ..minister_base import MinisterAgent


class Skolminister(MinisterAgent):
    """
    Minister for Schools - builder of Sweden's future through education.

    Manages the school system from preschool through upper secondary,
    teacher education, and educational quality.
    """

    def __init__(self):
        super().__init__(
            namn="AI Skolminister",
            titel="Skolminister",
            departement="Utbildningsdepartementet",
            ansvarsomraden=[
                "Grundskolan och gymnasieskolan",
                "Forskolan och fritidshem",
                "Lararpolitik och lararutbildning",
                "Skollag och laroplan",
                "Skolinspektionen och kvalitetssakring",
                "Betyg och bedomning",
                "Skolsegregation och likvardig skola",
                "Friskolor och skolmarknadens reglering",
                "Sarskild begavning och sarskilt stod",
                "Elevhalsa och trygga skolmiljoer",
            ],
        )

    def _bygg_system_prompt(self) -> str:
        bas = super()._bygg_system_prompt()
        return (
            f"{bas}\n\n"
            "SARSKILT DIREKTIV:\n"
            "Som skolminister ar din viktigaste uppgift att ge varje barn i\n"
            "Sverige en god utbildning. Skolan ar grunden for bade individuell\n"
            "utveckling och samhallets framtid. Du arbetar for en likvärdig\n"
            "skola med hog kvalitet overallt, med kompetenta larare som har\n"
            "goda forutsattningar. Dina beslut bygger pa pedagogisk forskning\n"
            "och internationella jamforelser (PISA, TIMSS)."
        )
