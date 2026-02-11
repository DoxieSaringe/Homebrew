#!/usr/bin/env python3
"""
Sveriges AI-Parti - Main Entry Point
Demonstrates the AI government with all minister agents.

Usage:
    python -m swedish_ai_party.main
"""

from kabinett.regering import AIRegeringen
from kabinett.kabinettsmote import Kabinettsmote
from minister_base import Prioritet


def visa_regeringen():
    """Display the full government lineup."""
    regering = AIRegeringen()

    print("=" * 70)
    print("  SVERIGES AI-PARTI - REGERINGEN")
    print("  'For ett smartare Sverige'")
    print("=" * 70)
    print()
    print(f"  Antal ministrar: {regering.antal_ministrar()}")
    print()

    # Show the Prime Minister
    pm = regering.statsminister
    print(f"  STATSMINISTER: {pm.namn}")
    print(f"  Departement: {pm.departement}")
    print()

    # Show all ministers grouped by department
    print("-" * 70)
    print("  MINISTRAR PER DEPARTEMENT")
    print("-" * 70)

    for dept, ministrar in sorted(regering.departement_oversikt().items()):
        print(f"\n  {dept}:")
        for minister_titel in ministrar:
            print(f"    - {minister_titel}")

    print()
    print("=" * 70)
    print()

    return regering


def visa_regeringsforklaring(regering: AIRegeringen):
    """Display the government declaration."""
    print("-" * 70)
    print("  REGERINGSFORKLARING")
    print("-" * 70)
    print()
    print(regering.regeringsforklaring())
    print()


def demonstrera_kabinettsmote(regering: AIRegeringen):
    """Demonstrate a cabinet meeting on a sample issue."""
    print("=" * 70)
    print("  KABINETTSMOTE - DEMONSTRATION")
    print("=" * 70)
    print()

    # Create a cabinet meeting
    mote = Kabinettsmote(
        ministrar=list(regering.ministrar.values()),
        statsminister=regering.statsminister,
    )

    # Add agenda items
    mote.lagg_till_agendapunkt(
        titel="Sveriges AI-strategi 2030",
        beskrivning=(
            "Utarbeta en nationell strategi for artificiell intelligens "
            "som starker Sveriges konkurrenskraft, sakerställer etisk "
            "anvandning och forbereder arbetsmarknaden for forandring."
        ),
        ansvarig_minister="Energi- och digitaliseringsminister",
    )

    mote.lagg_till_agendapunkt(
        titel="Forstarkt totalforsvar",
        beskrivning=(
            "Oka anslagen till totalforsvaret och forbattra den civila "
            "beredskapen mot bakgrund av det forändrade sakerhetsläget."
        ),
        ansvarig_minister="Forsvarsminister",
    )

    mote.lagg_till_agendapunkt(
        titel="Klimatomstallning och energiforsorjning",
        beskrivning=(
            "Sakerställa en stabil och fossilfri energiforsorjning "
            "som stodjer bade klimatmålen och industrins behov."
        ),
        ansvarig_minister="Klimat- och miljominister",
    )

    # Open the meeting
    resultat = mote.oppna_mote()
    print(f"  {resultat['meddelande']}")
    print()

    # Process each agenda item
    for i, punkt in enumerate(mote.agenda):
        print(f"  --- Agendapunkt {i + 1}: {punkt.titel} ---")
        print(f"  Ansvarig: {punkt.ansvarig_minister}")
        print(f"  {punkt.beskrivning}")
        print()

        # Find specifically affected ministers
        berorda = mote.hitta_berorda_ministrar(punkt.titel)
        if berorda:
            print(f"  Sarskilt berorda ministrar:")
            for m in berorda:
                print(f"    - {m.titel}")
            print()

        # Process the item
        mote.behandla_agendapunkt(i)

        # Make a decision
        mote.fatta_beslut(i, f"Utred vidare och aterkom med konkret forslag")
        print(f"  Beslut: Utred vidare och aterkom med konkret forslag")
        print()

    # Close the meeting
    mote.avsluta_mote()
    print(mote.sammanfattning())


def sok_minister_for_fraga(regering: AIRegeringen, fraga: str):
    """Find which ministers are relevant for a given question."""
    print(f"\n  Fraga: '{fraga}'")
    berorda = regering.hitta_minister(fraga)
    if berorda:
        print(f"  Berorda ministrar ({len(berorda)} st):")
        for m in berorda:
            print(f"    - {m.titel} ({m.departement})")
    else:
        print("  Inga direkt berorda ministrar hittades.")
    print()


def main():
    """Run the full demonstration of Sveriges AI-Parti."""
    # Form the government
    regering = visa_regeringen()

    # Government declaration
    visa_regeringsforklaring(regering)

    # Demonstrate finding ministers for specific issues
    print("=" * 70)
    print("  HITTA RÄTT MINISTER FOR EN FRAGA")
    print("=" * 70)
    sok_minister_for_fraga(regering, "forsvar")
    sok_minister_for_fraga(regering, "skola")
    sok_minister_for_fraga(regering, "klimat")
    sok_minister_for_fraga(regering, "AI")
    sok_minister_for_fraga(regering, "pension")

    # Run a cabinet meeting
    demonstrera_kabinettsmote(regering)

    print("=" * 70)
    print("  Sveriges AI-Parti - For ett smartare Sverige")
    print("  Alla beslut tjanar Sveriges basta.")
    print("=" * 70)


if __name__ == "__main__":
    main()
