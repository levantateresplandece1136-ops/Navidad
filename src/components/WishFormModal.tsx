import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload, X } from 'lucide-react';
import { Wish, WishPriority } from '../types/models';
import { FIELD_LIMITS, PRIORITY_LABELS, validateWishInput, WishFormInput } from '../utils/christmasLogic';
import { uploadWishImage } from '../services/storageService';

interface WishFormModalProps {
  open: boolean;
  uid: string;
  initialWish?: Wish | null;
  onSave: (input: WishFormInput, existingWishId?: string) => Promise<void>;
  onClose: () => void;
}

export function WishFormModal({ open, uid, initialWish, onSave, onClose }: WishFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [productURL, setProductURL] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [priority, setPriority] = useState<WishPriority>(WishPriority.ME_ENCANTARIA);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WishFormInput, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialWish) {
      setTitle(initialWish.title);
      setDescription(initialWish.description);
      setImageURL(initialWish.imageURL || '');
      setProductURL(initialWish.productURL || '');
      setEstimatedPrice(initialWish.estimatedPrice || '');
      setSize(initialWish.size || '');
      setColor(initialWish.color || '');
      setAdditionalDetails(initialWish.additionalDetails || '');
      setPriority(initialWish.priority);
    } else {
      setTitle('');
      setDescription('');
      setImageURL('');
      setProductURL('');
      setEstimatedPrice('');
      setSize('');
      setColor('');
      setAdditionalDetails('');
      setPriority(WishPriority.ME_ENCANTARIA);
    }
    setErrors({});
    setSubmitError(null);
  }, [open, initialWish]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !uploadingImage) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, uploadingImage, onClose]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    setUploadingImage(true);
    try {
      const url = await uploadWishImage(uid, file);
      setImageURL(url);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No pudimos subir la fotografía.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validation = validateWishInput({
      title,
      description,
      imageURL,
      productURL,
      estimatedPrice,
      size,
      color,
      additionalDetails,
      priority,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await onSave(validation.sanitized, initialWish?.wishId);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No pudimos guardar este deseo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#103728]/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wish-modal-title"
    >
      <div className="w-full sm:max-w-xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-[#174C38]/12 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#174C38]/10 flex items-center justify-between gap-4 bg-[#FFF8ED]/70">
          <h2 id="wish-modal-title" className="font-display text-xl font-semibold text-[#174C38]">
            {initialWish ? 'Editar mi deseo' : 'Agregar un deseo'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploadingImage}
            aria-label="Cerrar formulario de deseo"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-[#174C38]/65 hover:bg-white hover:text-[#174C38] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4" noValidate>
          {submitError && (
            <div
              role="alert"
              className="rounded-xl bg-[#B83232]/10 border border-[#B83232]/25 p-3 text-xs font-medium text-[#942424]"
            >
              {submitError}
            </div>
          )}

          <div>
            <label htmlFor="wish-title" className="block text-xs font-semibold text-[#174C38] mb-1.5">
              Nombre del regalo *
            </label>
            <input
              id="wish-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={FIELD_LIMITS.TITLE_MAX}
              placeholder="Ej. Cafetera francesa o suéter navideño"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
            />
            {errors.title && <p className="text-xs text-[#B83232] mt-1">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="wish-description" className="block text-xs font-semibold text-[#174C38] mb-1.5">
              Descripción *
            </label>
            <textarea
              id="wish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={FIELD_LIMITS.DESCRIPTION_MAX}
              rows={3}
              placeholder="Cuenta qué te gusta de este regalo o cómo esperas usarlo."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
            />
            {errors.description && <p className="text-xs text-[#B83232] mt-1">{errors.description}</p>}
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-[#174C38]">Fotografía del regalo (opcional)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="wish-photo-upload"
            />

            {imageURL ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#174C38]/15 bg-[#FFF8ED]">
                <img
                  src={imageURL}
                  alt="Vista previa del regalo"
                  referrerPolicy="no-referrer"
                  className="w-full h-48 object-cover"
                />
                <div className="p-2.5 bg-white/95 border-t border-[#174C38]/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[#174C38] hover:bg-[#FFF8ED] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Subiendo...' : 'Cambiar foto'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageURL('')}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B83232] hover:bg-[#B83232]/10 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full min-h-[84px] rounded-2xl border border-dashed border-[#174C38]/30 bg-[#FFF8ED]/60 hover:bg-[#FFF8ED] flex flex-col items-center justify-center gap-1.5 p-4 text-xs text-[#174C38]/80 transition-colors"
              >
                <ImagePlus className="w-5 h-5 text-[#B83232]" />
                <span className="font-semibold text-[#174C38]">
                  {uploadingImage ? 'Optimizando y subiendo fotografía...' : 'Subir fotografía desde celular o computadora'}
                </span>
                <span className="text-[11px] text-[#174C38]/60">JPG, PNG o WebP (se comprime automáticamente)</span>
              </button>
            )}
          </div>

          <div>
            <label htmlFor="wish-url" className="block text-xs font-semibold text-[#174C38] mb-1.5">
              Enlace del producto (TikTok, Temu, Amazon, Mercado Libre u otra tienda)
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-[#174C38]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="wish-url"
                type="url"
                value={productURL}
                onChange={(e) => setProductURL(e.target.value)}
                maxLength={FIELD_LIMITS.URL_MAX}
                placeholder="https://amazon.com.mx/..."
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
              />
            </div>
            {errors.productURL && <p className="text-xs text-[#B83232] mt-1">{errors.productURL}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="wish-price" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Precio aproximado
              </label>
              <input
                id="wish-price"
                type="text"
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(e.target.value)}
                maxLength={FIELD_LIMITS.PRICE_MAX}
                placeholder="Ej. $450 MXN"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
              />
            </div>
            <div>
              <label htmlFor="wish-size" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Talla opcional
              </label>
              <input
                id="wish-size"
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                maxLength={FIELD_LIMITS.SIZE_MAX}
                placeholder="Ej. M / 26 cm"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
              />
            </div>
            <div>
              <label htmlFor="wish-color" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Color opcional
              </label>
              <input
                id="wish-color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                maxLength={FIELD_LIMITS.COLOR_MAX}
                placeholder="Ej. Verde pino"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
              />
            </div>
          </div>

          <div>
            <label htmlFor="wish-details" className="block text-xs font-semibold text-[#174C38] mb-1.5">
              Características o detalles adicionales
            </label>
            <textarea
              id="wish-details"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              maxLength={FIELD_LIMITS.DETAILS_MAX}
              rows={2}
              placeholder="Marca preferida, modelo, notas sobre envío o versión..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#174C38] mb-1.5">Prioridad</span>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(WishPriority).map((p) => {
                const selected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      selected
                        ? 'bg-[#174C38] text-[#FFF8ED] border-[#174C38]'
                        : 'bg-white text-[#174C38]/80 border-[#174C38]/20 hover:bg-[#FFF8ED]'
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#174C38]/10 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || uploadingImage}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#174C38]/20 text-sm font-medium text-[#174C38] hover:bg-[#FFF8ED] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? 'Guardando...' : initialWish ? 'Guardar cambios' : 'Guardar deseo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
