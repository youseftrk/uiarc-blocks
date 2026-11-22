"use client";

import { useEffect, useRef, useState } from "react";
import { Switch } from "../switch/switch";
import {
  AiTranslate,
  type AiTranslateLanguageCode,
  type AiTranslateRequest,
} from "./ai-translate";
import styles from "./ai-translate.module.css";

const SAMPLE_TRANSLATIONS: Record<AiTranslateLanguageCode, string> = {
  fr: "Bonjour à tous ! La version 4.2 de l'app iOS est passée en revue chez Apple hier soir, avec le nouveau mode hors ligne. Les premiers retours de la bêta sont très bons : le temps de synchronisation passe de 9 à 3 secondes en moyenne. Pourriez-vous vérifier les traductions sur les écrans de paiement avant jeudi ? Merci d'avance, et beau travail sur ce sprint.",
  en: "Hi everyone! Version 4.2 of the iOS app went into Apple review last night, with the new offline mode. Early beta feedback is very good: sync time drops from 9 to 3 seconds on average. Could you check the translations on the payment screens before Thursday? Thanks in advance, and great work on this sprint.",
  de: "Hallo zusammen! Version 4.2 der iOS-App ging gestern Abend mit dem neuen Offline-Modus in die Apple-Prüfung. Das erste Beta-Feedback ist sehr gut: Die Synchronisierungszeit sinkt im Schnitt von 9 auf 3 Sekunden. Könntet ihr vor Donnerstag die Übersetzungen auf den Zahlungsbildschirmen prüfen? Vielen Dank vorab und starke Arbeit in diesem Sprint.",
  es: "¡Hola a todos! La versión 4.2 de la app de iOS entró anoche en revisión de Apple con el nuevo modo sin conexión. Los primeros comentarios de la beta son muy buenos: el tiempo de sincronización baja de 9 a 3 segundos de media. ¿Podríais revisar las traducciones en las pantallas de pago antes del jueves? Gracias de antemano y gran trabajo en este sprint.",
  ja: "みなさんこんにちは！新しいオフラインモードを搭載したiOSアプリ4.2が昨夜Appleの審査に入りました。初期ベータの反応はとても良く、同期時間は平均9秒から3秒に短縮されています。木曜までに決済画面の翻訳を確認してもらえますか？よろしくお願いします。今回のスプリントもお疲れさまでした。",
  pt: "Olá a todos! A versão 4.2 do app iOS entrou em revisão na Apple ontem à noite, com o novo modo offline. O feedback inicial da beta é muito bom: o tempo de sincronização cai de 9 para 3 segundos em média. Vocês poderiam conferir as traduções nas telas de pagamento antes de quinta-feira? Obrigado desde já e ótimo trabalho nesta sprint.",
};

export default function Demo() {
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(false);
  useEffect(() => {
    failNextRef.current = failNext;
  }, [failNext]);

  const translate = async ({ to, signal }: AiTranslateRequest) => {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 260);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
    if (failNextRef.current) {
      setFailNext(false);
      throw new Error("The translation service is unavailable.");
    }
    return SAMPLE_TRANSLATIONS[to];
  };

  return (
    <div className={styles.demo}>
      <AiTranslate
        translate={translate}
        simulated
        autoPlay
      />
      <div className={styles.demoControls}>
        <Switch
          label="Fail the next translation"
          checked={failNext}
          onCheckedChange={setFailNext}
        />
      </div>
    </div>
  );
}
