/// Système d'internationalisation trilingue FR / PT / Créole.
/// Les traductions sont stockées dans des maps Dart.
/// Le créole bissau-guinéen (gcr) peut être corrigé/ajusté facilement.
import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;

  AppLocalizations(this.locale);

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static const List<Locale> supportedLocales = [
    Locale('fr'),
    Locale('pt'),
    Locale('gcr'), // Créole bissau-guinéen
  ];

  String get languageCode => locale.languageCode;

  // === Traductions ===
  String get(String key) {
    return _translations[languageCode]?[key] ??
        _translations['fr']?[key] ??
        key;
  }

  /// Traduction avec paramètres : getf('cancel_fee_warning', {'fee': '500'})
  String getf(String key, Map<String, String> params) {
    var text = get(key);
    params.forEach((k, v) => text = text.replaceAll('{$k}', v));
    return text;
  }

  // Raccourcis fréquents
  String get appName => get('app_name');
  String get login => get('login');
  String get enterPhone => get('enter_phone');
  String get sendCode => get('send_code');
  String get enterOtp => get('enter_otp');
  String get verify => get('verify');
  String get firstName => get('first_name');
  String get lastName => get('last_name');
  String get passenger => get('passenger');
  String get driver => get('driver');
  String get moto => get('moto');
  String get car => get('car');
  String get whereToGo => get('where_to_go');
  String get proposePrice => get('propose_price');
  String get suggestedPrice => get('suggested_price');
  String get minPrice => get('min_price');
  String get maxPrice => get('max_price');
  String get sendRequest => get('send_request');
  String get waitingOffers => get('waiting_offers');
  String get noOffers => get('no_offers');
  String get accept => get('accept');
  String get counterOffer => get('counter_offer');
  String get driverEnRoute => get('driver_en_route');
  String get driverArrived => get('driver_arrived');
  String get onBoard => get('on_board');
  String get rideCompleted => get('ride_completed');
  String get pay => get('pay');
  String get cash => get('cash');
  String get mobileMoney => get('mobile_money');
  String get sos => get('sos');
  String get shareTrip => get('share_trip');
  String get cancel => get('cancel');
  String get confirm => get('confirm');
  String get goOnline => get('go_online');
  String get goOffline => get('go_offline');
  String get creditBalance => get('credit_balance');
  String get recharge => get('recharge');
  String get history => get('history');
  String get profile => get('profile');
  String get rateRide => get('rate_ride');
  String get xof => get('xof');
  String get km => get('km');
  String get min => get('min');

  static final Map<String, Map<String, String>> _translations = {
    'fr': {
      'app_name': 'MoveBissau',
      'login': 'Connexion',
      'enter_phone': 'Entrez votre numéro de téléphone',
      'send_code': 'Envoyer le code',
      'enter_otp': 'Entrez le code reçu par SMS',
      'verify': 'Vérifier',
      'first_name': 'Prénom',
      'last_name': 'Nom',
      'complete_profile': 'Compléter votre profil',
      'select_role': 'Je suis...',
      'passenger': 'Passager',
      'driver': 'Chauffeur',
      'moto': 'Moto-taxi',
      'car': 'Voiture',
      'where_to_go': 'Où allez-vous ?',
      'pickup': 'Point de départ',
      'destination': 'Destination',
      'propose_price': 'Proposez votre prix',
      'suggested_price': 'Prix suggéré',
      'min_price': 'Prix minimum',
      'max_price': 'Prix maximum',
      'send_request': 'Envoyer la demande',
      'waiting_offers': 'En attente d\'offres...',
      'no_offers': 'Aucun chauffeur disponible',
      'try_higher_price': 'Essayez un prix plus élevé',
      'offers_received': 'Offres reçues',
      'accept': 'Accepter',
      'counter_offer': 'Contre-offre',
      'driver_en_route': 'Chauffeur en route',
      'driver_arrived': 'Chauffeur arrivé !',
      'on_board': 'En course',
      'ride_completed': 'Course terminée',
      'pay': 'Payer',
      'cash': 'Espèces',
      'mobile_money': 'Mobile Money',
      'payment_method': 'Mode de paiement',
      'sos': 'SOS Urgence',
      'sos_confirm': 'Confirmer l\'appel d\'urgence ?',
      'share_trip': 'Partager le trajet',
      'cancel': 'Annuler',
      'confirm': 'Confirmer',
      'cancellation_fee': 'Frais d\'annulation',
      'go_online': 'Se mettre en ligne',
      'go_offline': 'Se mettre hors ligne',
      'online': 'En ligne',
      'offline': 'Hors ligne',
      'new_request': 'Nouvelle demande !',
      'make_offer': 'Faire une offre',
      'accept_price': 'Accepter le prix',
      'your_offer': 'Votre offre',
      'credit_balance': 'Crédit commission',
      'recharge': 'Recharger',
      'low_credit': 'Crédit bas ! Rechargez pour recevoir des courses.',
      'history': 'Historique',
      'profile': 'Profil',
      'rate_ride': 'Noter la course',
      'your_rating': 'Votre note',
      'comment_optional': 'Commentaire (optionnel)',
      'submit': 'Envoyer',
      'xof': 'XOF',
      'km': 'km',
      'min': 'min',
      'estimated_arrival': 'Arrivée estimée',
      'distance': 'Distance',
      'price': 'Prix',
      'rating': 'Note',
      'language': 'Langue',
      'french': 'Français',
      'portuguese': 'Português',
      'creole': 'Kriol',
      'logout': 'Déconnexion',
      'connection_lost': 'Connexion perdue',
      'reconnecting': 'Reconnexion...',
      'no_internet': 'Pas de connexion internet',
      'error': 'Erreur',
      'retry': 'Réessayer',
      'confirm_cash': 'Confirmer le paiement en espèces',
      'payment_received': 'Paiement reçu',
      'insufficient_credit': 'Crédit insuffisant',
      'unpaid_cancellation': 'Frais d\'annulation impayés',
      // Flux chauffeur
      'offer_accepted_title': 'Offre acceptée !',
      'offer_sent': 'Offre envoyée',
      'waiting_passenger': 'En attente de la réponse du passager...',
      'withdraw_offer': 'Retirer l\'offre',
      'offer_rejected_msg': 'Votre offre n\'a pas été retenue',
      'request_cancelled_msg': 'Le passager a annulé sa demande',
      'ride_in_progress': 'Course en cours',
      'resume_ride': 'Reprendre la course',
      'my_pending_offers': 'Mes offres en attente',
      'im_en_route': 'Je suis en route',
      'im_arrived': 'Je suis arrivé',
      'passenger_aboard': 'Passager à bord',
      'finish_ride': 'Terminer la course',
      'call': 'Appeler',
      'driver_assigned_label': 'Course acceptée',
      'cancel_ride_q': 'Annuler la course ?',
      'cancel_reason': 'Motif d\'annulation',
      'reason_passenger_unreachable': 'Passager injoignable',
      'reason_wrong_pickup': 'Mauvais point de départ',
      'reason_vehicle_issue': 'Problème de véhicule',
      'reason_other': 'Autre',
      'cancel_fee_warning': 'Des frais d\'annulation seront déduits de votre crédit.',
      'keep_ride': 'Continuer la course',
      'collect_cash': 'À encaisser en espèces',
      'commission_info': 'Commission de {amount} F déduite de votre crédit',
      'payment_confirmed': 'Paiement confirmé !',
      'ride_cancelled_by_passenger': 'Le passager a annulé la course',
      'ride_cancelled': 'Course annulée',
      'ignore_request': 'Ignorer cette demande',
      'waiting_requests': 'En attente de demandes...',
      'receiving_requests': 'Vous recevez des demandes de course',
      'tap_to_go_online': 'Appuyez pour vous mettre en ligne',
      'pickup_point': 'Point de départ',
      'dropoff_point': 'Destination',
      'confirm_cancel_ride': 'Oui, annuler la course',
      'rides': 'Courses',
      // Géocodage / recherche d'adresse
      'search_address': 'Rechercher une adresse ou un lieu',
      'my_position': 'Ma position actuelle',
      'recent_destinations': 'Destinations récentes',
      'popular_places': 'Lieux connus',
      'no_results': 'Aucun résultat',
      'try_other_terms': 'Essayez d\'autres termes',
      'locating': 'Localisation…',
      'tap_map_to_choose': 'Touchez la carte pour choisir la destination',
      'search_or_tap_map': 'Rechercher ou toucher la carte',
      'sos_confirm_msg': 'L\'équipe MoveBissau sera alertée et verra votre position en temps réel. En cas de danger immédiat, appelez directement la police.',
      'sos_sent_msg': 'Alerte envoyée à l\'équipe MoveBissau. Restez en ligne.',
      'promo_code_label': 'Code promo',
      'apply': 'Appliquer',
      'promo_applied_msg': 'Réduction appliquée !',
      'promo_invalid': 'Code promo invalide',
      'discount': 'Réduction',
      'driver_promo_note': 'Promo −{amount} F : compensée sur votre crédit commission',
      'passenger_proposed_price': 'Prix proposé par le passager',
      'vehicle': 'Véhicule',
    },
    'pt': {
      'app_name': 'MoveBissau',
      'login': 'Entrar',
      'enter_phone': 'Digite o seu número de telefone',
      'send_code': 'Enviar código',
      'enter_otp': 'Digite o código recebido por SMS',
      'verify': 'Verificar',
      'first_name': 'Nome',
      'last_name': 'Apelido',
      'complete_profile': 'Complete o seu perfil',
      'select_role': 'Eu sou...',
      'passenger': 'Passageiro',
      'driver': 'Motorista',
      'moto': 'Moto-táxi',
      'car': 'Carro',
      'where_to_go': 'Para onde vai?',
      'pickup': 'Ponto de partida',
      'destination': 'Destino',
      'propose_price': 'Proponha o seu preço',
      'suggested_price': 'Preço sugerido',
      'min_price': 'Preço mínimo',
      'max_price': 'Preço máximo',
      'send_request': 'Enviar pedido',
      'waiting_offers': 'À espera de ofertas...',
      'no_offers': 'Nenhum motorista disponível',
      'try_higher_price': 'Tente um preço mais alto',
      'offers_received': 'Ofertas recebidas',
      'accept': 'Aceitar',
      'counter_offer': 'Contra-oferta',
      'driver_en_route': 'Motorista a caminho',
      'driver_arrived': 'Motorista chegou!',
      'on_board': 'Em viagem',
      'ride_completed': 'Viagem concluída',
      'pay': 'Pagar',
      'cash': 'Dinheiro',
      'mobile_money': 'Mobile Money',
      'payment_method': 'Método de pagamento',
      'sos': 'SOS Emergência',
      'sos_confirm': 'Confirmar chamada de emergência?',
      'share_trip': 'Partilhar viagem',
      'cancel': 'Cancelar',
      'confirm': 'Confirmar',
      'cancellation_fee': 'Taxa de cancelamento',
      'go_online': 'Ficar online',
      'go_offline': 'Ficar offline',
      'online': 'Online',
      'offline': 'Offline',
      'new_request': 'Novo pedido!',
      'make_offer': 'Fazer oferta',
      'accept_price': 'Aceitar preço',
      'your_offer': 'A sua oferta',
      'credit_balance': 'Crédito comissão',
      'recharge': 'Recarregar',
      'low_credit': 'Crédito baixo! Recarregue para receber viagens.',
      'history': 'Histórico',
      'profile': 'Perfil',
      'rate_ride': 'Avaliar viagem',
      'your_rating': 'A sua avaliação',
      'comment_optional': 'Comentário (opcional)',
      'submit': 'Enviar',
      'xof': 'XOF',
      'km': 'km',
      'min': 'min',
      'estimated_arrival': 'Chegada estimada',
      'distance': 'Distância',
      'price': 'Preço',
      'rating': 'Avaliação',
      'language': 'Língua',
      'french': 'Français',
      'portuguese': 'Português',
      'creole': 'Kriol',
      'logout': 'Sair',
      'connection_lost': 'Conexão perdida',
      'reconnecting': 'Reconectando...',
      'no_internet': 'Sem conexão à internet',
      'error': 'Erro',
      'retry': 'Tentar novamente',
      'confirm_cash': 'Confirmar pagamento em dinheiro',
      'payment_received': 'Pagamento recebido',
      'insufficient_credit': 'Crédito insuficiente',
      'unpaid_cancellation': 'Taxa de cancelamento não paga',
      // Fluxo motorista
      'offer_accepted_title': 'Oferta aceite!',
      'offer_sent': 'Oferta enviada',
      'waiting_passenger': 'À espera da resposta do passageiro...',
      'withdraw_offer': 'Retirar oferta',
      'offer_rejected_msg': 'A sua oferta não foi escolhida',
      'request_cancelled_msg': 'O passageiro cancelou o pedido',
      'ride_in_progress': 'Viagem em curso',
      'resume_ride': 'Retomar viagem',
      'my_pending_offers': 'As minhas ofertas pendentes',
      'im_en_route': 'Estou a caminho',
      'im_arrived': 'Cheguei',
      'passenger_aboard': 'Passageiro a bordo',
      'finish_ride': 'Terminar viagem',
      'call': 'Ligar',
      'driver_assigned_label': 'Viagem aceite',
      'cancel_ride_q': 'Cancelar a viagem?',
      'cancel_reason': 'Motivo do cancelamento',
      'reason_passenger_unreachable': 'Passageiro incontactável',
      'reason_wrong_pickup': 'Ponto de partida errado',
      'reason_vehicle_issue': 'Problema com o veículo',
      'reason_other': 'Outro',
      'cancel_fee_warning': 'Uma taxa de cancelamento será deduzida do seu crédito.',
      'keep_ride': 'Continuar viagem',
      'collect_cash': 'A receber em dinheiro',
      'commission_info': 'Comissão de {amount} F deduzida do seu crédito',
      'payment_confirmed': 'Pagamento confirmado!',
      'ride_cancelled_by_passenger': 'O passageiro cancelou a viagem',
      'ride_cancelled': 'Viagem cancelada',
      'ignore_request': 'Ignorar este pedido',
      'waiting_requests': 'À espera de pedidos...',
      'receiving_requests': 'Está a receber pedidos de viagem',
      'tap_to_go_online': 'Toque para ficar online',
      'pickup_point': 'Ponto de partida',
      'dropoff_point': 'Destino',
      'confirm_cancel_ride': 'Sim, cancelar a viagem',
      'rides': 'Viagens',
      // Geocodificação / pesquisa de endereço
      'search_address': 'Pesquisar um endereço ou local',
      'my_position': 'A minha posição atual',
      'recent_destinations': 'Destinos recentes',
      'popular_places': 'Locais conhecidos',
      'no_results': 'Nenhum resultado',
      'try_other_terms': 'Tente outras palavras',
      'locating': 'A localizar…',
      'tap_map_to_choose': 'Toque no mapa para escolher o destino',
      'search_or_tap_map': 'Pesquisar ou tocar no mapa',
      'sos_confirm_msg': 'A equipa MoveBissau será alertada e verá a sua posição em tempo real. Em caso de perigo imediato, ligue diretamente à polícia.',
      'sos_sent_msg': 'Alerta enviado à equipa MoveBissau. Fique atento.',
      'promo_code_label': 'Código promocional',
      'apply': 'Aplicar',
      'promo_applied_msg': 'Desconto aplicado!',
      'promo_invalid': 'Código promocional inválido',
      'discount': 'Desconto',
      'driver_promo_note': 'Promoção −{amount} F: compensada no seu crédito comissão',
      'passenger_proposed_price': 'Preço proposto pelo passageiro',
      'vehicle': 'Veículo',
    },
    'gcr': {
      // Créole bissau-guinéen — orthographe simplifiée
      'app_name': 'MoveBissau',
      'login': 'Entra',
      'enter_phone': 'Pui bu numeru di telefoni',
      'send_code': 'Manda kodigu',
      'enter_otp': 'Pui kodigu ki bu risebe na SMS',
      'verify': 'Verifica',
      'first_name': 'Nomi',
      'last_name': 'Sobrinomi',
      'complete_profile': 'Kompleta bu perfil',
      'select_role': 'N na...',
      'passenger': 'Pasajeru',
      'driver': 'Xofer',
      'moto': 'Moto-taxi',
      'car': 'Karu',
      'where_to_go': 'Bu na bai undi?',
      'pickup': 'Kal ki bu sta',
      'destination': 'Kal ki bu na bai',
      'propose_price': 'Fala bu presu',
      'suggested_price': 'Presu sujeridu',
      'min_price': 'Presu minimu',
      'max_price': 'Presu maximu',
      'send_request': 'Manda pedidu',
      'waiting_offers': 'Na spera oferta...',
      'no_offers': 'Ninguin xofer no sta disponivel',
      'try_higher_price': 'Tenta un presu mas altu',
      'offers_received': 'Oferta ki txiga',
      'accept': 'Seta',
      'counter_offer': 'Kontra-oferta',
      'driver_en_route': 'Xofer na bin',
      'driver_arrived': 'Xofer txiga!',
      'on_board': 'Na kaminu',
      'ride_completed': 'Viaji kaba',
      'pay': 'Paga',
      'cash': 'Dineru na mon',
      'mobile_money': 'Mobile Money',
      'payment_method': 'Manera di paga',
      'sos': 'SOS Emerjensia',
      'sos_confirm': 'Konfirma txamada di emerjensia?',
      'share_trip': 'Partilha viaji',
      'cancel': 'Kansela',
      'confirm': 'Konfirma',
      'cancellation_fee': 'Taksa di kanselamentu',
      'go_online': 'Fica online',
      'go_offline': 'Fica offline',
      'online': 'Online',
      'offline': 'Offline',
      'new_request': 'Pedidu nobu!',
      'make_offer': 'Fasi oferta',
      'accept_price': 'Seta presu',
      'your_offer': 'Bu oferta',
      'credit_balance': 'Kreditu komisaun',
      'recharge': 'Karega',
      'low_credit': 'Kreditu baxu! Karega pa risebe viaji.',
      'history': 'Istoriku',
      'profile': 'Perfil',
      'rate_ride': 'Da nota na viaji',
      'your_rating': 'Bu nota',
      'comment_optional': 'Komentariu (si bu kre)',
      'submit': 'Manda',
      'xof': 'XOF',
      'km': 'km',
      'min': 'min',
      'estimated_arrival': 'Ora di txiga',
      'distance': 'Distansia',
      'price': 'Presu',
      'rating': 'Nota',
      'language': 'Lingua',
      'french': 'Français',
      'portuguese': 'Português',
      'creole': 'Kriol',
      'logout': 'Sai',
      'connection_lost': 'Koneksaun pirdidu',
      'reconnecting': 'Na liga di nobu...',
      'no_internet': 'Sin koneksaun',
      'error': 'Eru',
      'retry': 'Tenta di nobu',
      'confirm_cash': 'Konfirma pagamentu na dineru',
      'payment_received': 'Pagamentu risebidu',
      'insufficient_credit': 'Kreditu no txiga',
      'unpaid_cancellation': 'Taksa di kanselamentu no pagadu',
      // Fluxu di xofer
      'offer_accepted_title': 'Oferta setadu!',
      'offer_sent': 'Oferta mandadu',
      'waiting_passenger': 'Na spera resposta di pasajeru...',
      'withdraw_offer': 'Tira oferta',
      'offer_rejected_msg': 'Bu oferta ka setadu',
      'request_cancelled_msg': 'Pasajeru kansela pedidu',
      'ride_in_progress': 'Viaji na kaminu',
      'resume_ride': 'Volta pa viaji',
      'my_pending_offers': 'Nha oferta na spera',
      'im_en_route': 'N na bai',
      'im_arrived': 'N txiga',
      'passenger_aboard': 'Pasajeru sinta',
      'finish_ride': 'Kaba viaji',
      'call': 'Toka',
      'driver_assigned_label': 'Viaji setadu',
      'cancel_ride_q': 'Kansela viaji?',
      'cancel_reason': 'Motivu di kanselamentu',
      'reason_passenger_unreachable': 'Pasajeru ka na atende',
      'reason_wrong_pickup': 'Kau di partida eradu',
      'reason_vehicle_issue': 'Problema di karu',
      'reason_other': 'Utru',
      'cancel_fee_warning': 'Taksa di kanselamentu na tiradu di bu kreditu.',
      'keep_ride': 'Kontinua viaji',
      'collect_cash': 'Pa risebe na dineru',
      'commission_info': 'Komisaun di {amount} F na tiradu di bu kreditu',
      'payment_confirmed': 'Pagamentu konfirmadu!',
      'ride_cancelled_by_passenger': 'Pasajeru kansela viaji',
      'ride_cancelled': 'Viaji kanseladu',
      'ignore_request': 'Iñora e pedidu',
      'waiting_requests': 'Na spera pedidu...',
      'receiving_requests': 'Bu na risebe pedidu di viaji',
      'tap_to_go_online': 'Toka pa fica online',
      'pickup_point': 'Kau di partida',
      'dropoff_point': 'Kau di bai',
      'confirm_cancel_ride': 'Sin, kansela viaji',
      'rides': 'Viaji',
      // Jeokodifikason / buska di adresu
      'search_address': 'Buska un adresu o kau',
      'my_position': 'Nha pozison di gosi',
      'recent_destinations': 'Kau resenti',
      'popular_places': 'Kau konhesidu',
      'no_results': 'Nada ka atxadu',
      'try_other_terms': 'Tenta utru palabra',
      'locating': 'Na lokaliza…',
      'tap_map_to_choose': 'Toka na mapa pa kudji kau di bai',
      'search_or_tap_map': 'Buska o toka na mapa',
      'sos_confirm_msg': 'Ekipa MoveBissau na alertadu i e na odja bu pozison. Si perigu sta pertu, toka polisia diretamenti.',
      'sos_sent_msg': 'Alerta mandadu pa ekipa MoveBissau.',
      'promo_code_label': 'Kodigu promo',
      'apply': 'Aplika',
      'promo_applied_msg': 'Diskontu aplikadu!',
      'promo_invalid': 'Kodigu promo ka bali',
      'discount': 'Diskontu',
      'driver_promo_note': 'Promo −{amount} F: kompensadu na bu kreditu komisaun',
      'passenger_proposed_price': 'Presu ki pasajeru fala',
      'vehicle': 'Karu',
    },
  };
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      ['fr', 'pt', 'gcr'].contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) async =>
      AppLocalizations(locale);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
