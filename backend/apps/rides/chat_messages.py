"""
Messages de chat prédéfinis, identifiés par clé.
Chaque client affiche la clé dans SA langue (un passager kriol et un
chauffeur portugais se comprennent). Le backend s'en sert pour l'aperçu
des notifications push dans la langue du destinataire.

Les clés doivent rester synchronisées avec les clients (React + Flutter).
"""

CHAT_MESSAGES = {
    'chat_where_are_you': {
        'fr': 'Où êtes-vous ?',
        'pt': 'Onde está?',
        'gcr': 'Bu sta undi?',
    },
    'chat_im_coming': {
        'fr': "J'arrive",
        'pt': 'Estou a chegar',
        'gcr': 'N na txiga',
    },
    'chat_im_here': {
        'fr': 'Je suis là',
        'pt': 'Cheguei',
        'gcr': 'N txiga',
    },
    'chat_at_pickup': {
        'fr': 'Je suis au point de départ',
        'pt': 'Estou no ponto de partida',
        'gcr': 'N sta na kau di partida',
    },
    'chat_wait_2min': {
        'fr': 'Attendez-moi 2 minutes',
        'pt': 'Espere 2 minutos',
        'gcr': 'Spera n 2 minutu',
    },
    'chat_traffic': {
        'fr': 'Il y a des embouteillages',
        'pt': 'Há trânsito',
        'gcr': 'Strada sta cheiu',
    },
    'chat_call_me': {
        'fr': "Appelez-moi s'il vous plaît",
        'pt': 'Ligue-me por favor',
        'gcr': 'Toka n pur favor',
    },
    'chat_ok': {
        'fr': 'OK 👍',
        'pt': 'OK 👍',
        'gcr': 'OK 👍',
    },
}


def render_chat_message(message_key: str, lang: str, fallback: str = '') -> str:
    """Rend un message prédéfini dans une langue donnée."""
    entry = CHAT_MESSAGES.get(message_key)
    if not entry:
        return fallback
    return entry.get(lang) or entry.get('fr') or fallback
