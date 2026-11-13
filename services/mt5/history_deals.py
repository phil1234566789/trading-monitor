"""Gemeinsame native Deal-Normalisierung für Vollabgleich und gezielte Positionskosten."""
def normalise_deal(deal,offset):
    d=deal._asdict()
    return dict(ticket=int(d['ticket']),position_id=int(d['position_id']),
                time_msc=int(d['time_msc'])-offset*1000,type=int(d['type']),entry=int(d['entry']),
                symbol=d['symbol'],volume=float(d['volume']),price=float(d['price']),
                profit=float(d['profit']),commission=float(d['commission']),swap=float(d['swap']),fee=float(d['fee']))

