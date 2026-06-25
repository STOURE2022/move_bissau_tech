"""Middleware personnalisé pour MoveBissau."""
from django.utils import translation


class LanguageMiddleware:
    """
    Active la langue préférée de l'utilisateur authentifié.
    Fallback sur le header Accept-Language puis sur 'fr'.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        lang = 'fr'  # Langue par défaut

        # Si l'utilisateur est authentifié, utiliser sa langue préférée
        if hasattr(request, 'user') and request.user.is_authenticated:
            lang = getattr(request.user, 'preferred_lang', 'fr')
        else:
            # Sinon, vérifier le header Accept-Language
            accept_lang = request.META.get('HTTP_ACCEPT_LANGUAGE', '')
            if 'pt' in accept_lang:
                lang = 'pt'
            elif 'gcr' in accept_lang:
                lang = 'gcr'

        translation.activate(lang)
        response = self.get_response(request)
        return response
